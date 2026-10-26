import express from 'express';
import {randomBytes,randomUUID,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from './store.mjs';
import {schemas,settingsSchema,userSchema,activitySchema,changePasswordSchema,resetPasswordSchema} from './schema.mjs';
import {calculateQuote} from '../shared/quote.mjs';
import {zodMessages} from '../shared/errors.mjs';
import {canWrite as sharedCanWrite,keepsOwner as sharedKeepsOwner} from '../shared/permissions.mjs';
import {isCompanyEmail,normalizeEmail} from '../shared/auth.mjs';
import {securityHeaders,allowedWriteOrigin} from './security.mjs';
import {team} from './team.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const app=express();
let storePromise;
export const getStore=()=>storePromise||(storePromise=createStore(process.env.DB_PATH||join(root,'data/growth.sqlite')).catch(e=>{storePromise=null;throw e;}));
const hash=s=>createHash('sha256').update(s).digest('hex');
const deriveKey=promisify(scrypt);
const passwordHash=async p=>{const salt=randomBytes(16).toString('hex');return salt+':'+(await deriveKey(p,salt,64)).toString('hex');};
const checkPassword=async(p,saved)=>{try{const[salt,key]=saved.split(':');return timingSafeEqual(Buffer.from(key,'hex'),await deriveKey(p,salt,64));}catch{return false;}};
const dummyPassword=await passwordHash(randomBytes(32).toString('hex'));
const production=!!process.env.VERCEL||process.env.NODE_ENV==='production';
const setupProtected=production||!!process.env.SETUP_TOKEN;
const attemptWindow=15*60000;
const attemptKey=(scope,value)=>`${scope}:${hash(value)}`;
async function recordAttempt(store,key){const now=Date.now();return store.one('INSERT INTO login_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN login_attempts.expires<? THEN 1 ELSE login_attempts.count+1 END,expires=CASE WHEN login_attempts.expires<? THEN excluded.expires ELSE login_attempts.expires END RETURNING count',[key,now+attemptWindow,now,now]);}
const clearAttempts=(store,key)=>store.query('DELETE FROM login_attempts WHERE key=?',[key]);
const releaseAttempt=(store,key)=>store.query('UPDATE login_attempts SET count=CASE WHEN count>0 THEN count-1 ELSE 0 END WHERE key=?',[key]);
const pruneAttempts=store=>store.query('DELETE FROM login_attempts WHERE expires<?',[Date.now()]);
const sameSecret=(a,b)=>timingSafeEqual(Buffer.from(hash(a),'hex'),Buffer.from(hash(b),'hex'));
const publicUser=({id,name,email,role})=>({id,name,email,role});
const cookieToken=req=>req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('pz_session='))?.slice(11);
const fail=(res,status,error)=>res.status(status).json({error});
app.disable('x-powered-by');
app.set('trust proxy',process.env.VERCEL?1:false);
app.use(securityHeaders(production));
app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.use(express.json({limit:'256kb',inflate:false}));
app.get('/api/health',async(_req,res)=>{const s=await getStore();await s.one('SELECT 1 AS ok');res.json({ok:true});});
app.use('/api',async(req,res,next)=>{
 res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){
  if(!allowedWriteOrigin(req))return fail(res,403,'Origen no permitido.');
  if(!req.is('application/json'))return fail(res,415,'Se requiere application/json.');
 }
 req.store=await getStore();
 const token=cookieToken(req);
 if(token)req.user=await req.store.one('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?',[hash(token),Date.now()]);
 next();
});
async function session(res,user,store){
 const token=randomBytes(32).toString('hex');
 await store.query('DELETE FROM sessions WHERE expires<?',[Date.now()]);
 await store.query('INSERT INTO sessions VALUES(?,?,?)',[hash(token),user.id,Date.now()+86400000*7]);
 res.cookie('pz_session',token,{httpOnly:true,sameSite:'strict',secure:production||process.env.COOKIE_SECURE==='true',maxAge:86400000*7,path:'/'});
}
app.get('/api/session',async(req,res)=>res.json({user:req.user||null,configured:!!await req.store.one('SELECT id FROM users LIMIT 1'),setupProtected}));
app.post('/api/setup',async(req,res)=>{
  const s=req.store;
  await pruneAttempts(s);
  const key=attemptKey('setup-ip',req.ip||'unknown');
  if((await recordAttempt(s,key)).count>10)return fail(res,429,'Demasiados intentos. Intenta nuevamente en 15 minutos.');
  if(await s.one('SELECT id FROM users LIMIT 1'))return fail(res,409,'El espacio ya está configurado. Inicia sesión.');
  if(setupProtected&&(!process.env.SETUP_TOKEN||process.env.SETUP_TOKEN.length<32))return fail(res,503,'Configura SETUP_TOKEN con al menos 32 caracteres antes de activar el espacio.');
  if(setupProtected&&!sameSecret(String(req.body?.setupToken||''),process.env.SETUP_TOKEN||''))return fail(res,403,'Código de activación incorrecto.');
  const data=userSchema.parse({...req.body,role:'Dirección'});const user={...data,id:randomUUID()};
  const savedPassword=await passwordHash(user.password);
  await s.transaction(async()=>{await s.setupLock();if(await s.one('SELECT id FROM users LIMIT 1')){const e=new Error('El espacio ya está configurado.');e.status=409;throw e;}await s.query('INSERT INTO users VALUES(?,?,?,?,?)',[user.id,user.name,user.email,savedPassword,'Dirección']);await s.initialize();});
  await session(res,user,s);res.status(201).json(publicUser(user));
});
app.post('/api/login',async(req,res)=>{
  if(typeof req.body?.email!=='string'||req.body.email.length>200||typeof req.body?.password!=='string'||req.body.password.length>200)return fail(res,400,'Ingresa correo y contraseña.');
  await pruneAttempts(req.store);
  const email=normalizeEmail(req.body.email);const ip=req.ip||'unknown';
  const accountKey=attemptKey('login-account',email);const ipKey=attemptKey('login-ip',ip);
  // Reserve attempts atomically before expensive verification, including concurrent requests.
  if((await recordAttempt(req.store,ipKey)).count>30)return fail(res,429,'Demasiados intentos. Intenta nuevamente en 15 minutos.');
  if((await recordAttempt(req.store,accountKey)).count>5)return fail(res,429,'Demasiados intentos. Intenta nuevamente en 15 minutos.');
  const u=isCompanyEmail(email)?await req.store.one('SELECT * FROM users WHERE email=?',[email]):null;
  const passwordMatches=await checkPassword(req.body.password,u?.password||dummyPassword);
  if(!isCompanyEmail(email)||!u||!passwordMatches)return fail(res,401,'Correo o contraseña incorrectos.');
  await releaseAttempt(req.store,accountKey);await releaseAttempt(req.store,ipKey);await session(res,u,req.store);res.json(publicUser(u));
});
app.post('/api/logout',async(req,res)=>{const token=cookieToken(req);if(token)await req.store.query('DELETE FROM sessions WHERE hash=?',[hash(token)]);res.clearCookie('pz_session',{path:'/'});res.json({ok:true});});
app.use('/api',(req,res,next)=>req.user?next():fail(res,401,'Inicia sesión para acceder al espacio de trabajo.'));
const admin=(req,res,next)=>req.user.role==='Dirección'?next():fail(res,403,'Esta acción requiere el rol Dirección.');
app.post('/api/password',async(req,res)=>{
  const {currentPassword,newPassword}=changePasswordSchema.parse(req.body);
  const key=attemptKey('password-user',req.user.id);
  if((await recordAttempt(req.store,key)).count>5)return fail(res,429,'Demasiados intentos. Intenta nuevamente en 15 minutos.');
  const row=await req.store.one('SELECT password FROM users WHERE id=?',[req.user.id]);
  if(!row||!await checkPassword(currentPassword,row.password))return fail(res,403,'La contraseña actual no es correcta.');
  const currentToken=cookieToken(req);
  const savedPassword=await passwordHash(newPassword);
  await req.store.transaction(async()=>{await req.store.query('UPDATE users SET password=? WHERE id=?',[savedPassword,req.user.id]);await req.store.query('DELETE FROM sessions WHERE user_id=? AND hash<>?',[req.user.id,hash(currentToken)]);});
  await clearAttempts(req.store,key);
  res.json({ok:true});
});
app.get('/api/state',async(req,res)=>{
 const state=await req.store.state();
 if(req.user.role==='Colaborador externo'){
  for(const c of Object.keys(schemas))state[c]=['tasks','initiatives','content','projects'].includes(c)?state[c].filter(v=>v.owner===req.user.name):[];
  state.activities=[];
  state.projects=state.projects.map(({id,name,market,owner,status,hours,date,reviewDate,checklist})=>({id,name,market,owner,status,hours,date,reviewDate,checklist}));
  state.settings={name:state.settings.name,baseCurrency:state.settings.baseCurrency,roadmapStart:state.settings.roadmapStart};
 }
 if(req.user.role==='Comercial')state.quotes=state.quotes.filter(q=>q.ownerId===req.user.id);
 if(req.user.role==='Estrategia / Diseño')state.quotes=[];
 const team=await req.store.query('SELECT id,name,role FROM users');
 state.team=req.user.role==='Colaborador externo'?team.filter(u=>u.id===req.user.id):team;res.json(state);
});
app.get('/api/strategy',(req,res)=>req.user.role==='Colaborador externo'?fail(res,403,'Sin permisos para acceder a la estrategia interna.'):res.download(join(root,'server/estrategia-planozero.md')));
app.get('/api/users',admin,async(req,res)=>res.json(await req.store.query('SELECT id,name,email,role FROM users')));
app.post('/api/users',admin,async(req,res)=>{const data=userSchema.parse(req.body);if(await req.store.one('SELECT id FROM users WHERE email=? OR name=?',[data.email,data.name]))return fail(res,409,'Ya existe un usuario con ese nombre o correo.');const u={...data,id:randomUUID()};await req.store.query('INSERT INTO users VALUES(?,?,?,?,?)',[u.id,u.name,u.email,await passwordHash(u.password),u.role]);res.status(201).json(publicUser(u));});
app.put('/api/users/:id/password',admin,async(req,res)=>{const{newPassword}=resetPasswordSchema.parse(req.body);const user=await req.store.one('SELECT id FROM users WHERE id=?',[req.params.id]);if(!user)return fail(res,404,'Usuario no encontrado.');await req.store.transaction(async()=>{await req.store.query('UPDATE users SET password=? WHERE id=?',[await passwordHash(newPassword),user.id]);await req.store.query('DELETE FROM sessions WHERE user_id=?',[user.id]);});res.json({ok:true});});
app.post('/api/users/provision-executives',admin,async(req,res)=>{
  const requested=team;const users=[];
  await req.store.transaction(async()=>{for(const[name,email]of requested){const existing=await req.store.one('SELECT id,name,email,role FROM users WHERE email=?',[email]);if(existing){users.push({...publicUser(existing),created:false});continue;}if(await req.store.one('SELECT id FROM users WHERE name=?',[name])){const e=new Error(`Ya existe un usuario llamado ${name} con otro correo.`);e.status=409;throw e;}const password=randomBytes(24).toString('base64url');const data=userSchema.parse({name,email,password,role:'Comercial'});const user={...data,id:randomUUID()};await req.store.query('INSERT INTO users VALUES(?,?,?,?,?)',[user.id,user.name,user.email,await passwordHash(password),user.role]);users.push({...publicUser(user),password,created:true});}});
  res.status(201).json({users});
});
app.put('/api/settings',admin,async(req,res)=>{const data=settingsSchema.parse(req.body);await req.store.config('settings',data);res.json(data);});
function canWrite(req,c,existing){return sharedCanWrite(req.user,c,existing)&&sharedKeepsOwner(req.user,existing,req.body);}
app.post('/api/activities',async(req,res)=>{
 const data=activitySchema.parse(req.body);const row=await req.store.one("SELECT body FROM records WHERE collection='prospects' AND id=?",[data.prospectId]);if(!row)return fail(res,404,'Prospecto no encontrado.');
 const p=JSON.parse(row.body);if(!canWrite(req,'prospects',p))return fail(res,403,'Sin permisos para registrar actividad comercial.');
 const a={...data,id:randomUUID(),owner:req.user.name,market:p.market};
 await req.store.transaction(async()=>{await req.store.put('activities',a);p.updatedAt=new Date().toISOString();p.history=[...(p.history||[]),{id:a.id,type:data.type,text:data.name,date:data.date,author:req.user.name}];await req.store.put('prospects',p);});res.status(201).json(a);
});
async function saveRecord(req,res){
 const {collection:c,id}=req.params;if(!schemas[c])return fail(res,404,'Recurso no encontrado.');
 const existing=id&&await req.store.one('SELECT body FROM records WHERE collection=? AND id=?',[c,id]);
 if(id&&!existing)return fail(res,404,'Registro no encontrado.');
 if(!canWrite(req,c,existing&&JSON.parse(existing.body)))return fail(res,403,'Tu rol no permite esta acción.');
 let data=schemas[c].parse(req.body);const state=(c==='prospects'||c==='quotes')?await req.store.state():null;
 if(c==='prospects'&&!state.offers.some(o=>o.id===data.offerId))return fail(res,400,'Selecciona una oferta válida.');
 if(c==='quotes'){
   const old=existing&&JSON.parse(existing.body);
   const locked=old&&['Enviada','Aceptada','Archivada'].includes(old.status);
  if(locked && ['Borrador','Enviada','Aceptada','Archivada'].includes(data.status)){
   // Sent quotes keep their exact commercial snapshot; changes require a new copy.
   data={...old,status:data.status};if(data.status==='Borrador')return fail(res,409,'Duplica la cotización enviada para modificarla.');
  } else {
   const kept=new Set((old?.lines||[]).map(l=>l.profileId));
   const offer=state.offers.find(o=>o.id===data.serviceId);
   for(const a of offer?.allocations||[])kept.add(a.profileId);
   data.lines=data.lines.map(l=>{const p=state.profiles.find(p=>p.id===l.profileId);if(!p||(!p.active&&!kept.has(p.id)))throw Object.assign(new Error('Selecciona perfiles activos o ya asignados.'),{status:400});return {profileId:p.id,name:p.name,hours:l.hours,rate:p.cost,currency:p.currency};});
   data.eurUsd=state.settings.eurUsd;data.usdClp=state.settings.usdClp;data.ratesDate=state.settings.ratesDate;
   data.totals=calculateQuote(data);
  }
 }
 res.status(id?200:201).json(await req.store.save(c,data,id,req.user));
}
app.post('/api/:collection',saveRecord);app.put('/api/:collection/:id',saveRecord);
app.delete('/api/:collection/:id',async(req,res)=>{
 const{collection:c,id}=req.params;if(!schemas[c])return fail(res,404,'Recurso no encontrado.');const row=await req.store.one('SELECT body FROM records WHERE collection=? AND id=?',[c,id]);if(!row)return fail(res,404,'Registro no encontrado.');if(!canWrite(req,c,JSON.parse(row.body)))return fail(res,403,'Tu rol no permite esta acción.');
 if(['offers','prospects','profiles'].includes(c)){
  const s=await req.store.state();
  if((c==='offers'&&(s.projects.some(p=>p.offerId===id)||s.prospects.some(p=>p.offerId===id)))||(c==='prospects'&&s.projects.some(p=>p.prospectId===id)))return fail(res,409,'Este registro tiene datos vinculados.');
  if(c==='profiles'&&(s.quotes.some(q=>q.lines.some(l=>l.profileId===id))||s.offers.some(o=>o.allocations?.some(l=>l.profileId===id))))return fail(res,409,'Desactiva el perfil para conservar sus cotizaciones y asignaciones.');
 }
 await req.store.query('DELETE FROM records WHERE collection=? AND id=?',[c,id]);res.json({ok:true});
});
app.use('/api',(_req,res)=>fail(res,404,'Recurso no encontrado.'));
app.use((error,_req,res,_next)=>{
 if(error.type==='entity.parse.failed')return fail(res,400,'El cuerpo de la solicitud no es JSON válido.');
 if(error.type==='entity.too.large')return fail(res,413,'La solicitud es demasiado grande.');
 if(error.name==='ZodError')return fail(res,400,zodMessages(error));
 console.error(error.message);
 fail(res,error.status||503,error.status?error.message:'El servicio no está disponible. Intenta nuevamente.');
});
export default app;
