import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { COLLECTIONS, createSeed, today, wonEffects } from '../shared/domain.mjs';
// The repo ships illustrative numbers; the real catalog stays in a private, git-ignored file.
const catalogFile = existsSync(new URL('./catalog.private.json', import.meta.url)) ? './catalog.private.json' : './catalog.json';
const catalog = JSON.parse(readFileSync(new URL(catalogFile, import.meta.url),'utf8'));
const supabaseCa = readFileSync(new URL('./supabase-ca.crt', import.meta.url),'utf8');
export async function createStore(path, connectionString = process.env.DATABASE_URL) {
  const context = new AsyncLocalStorage();
  let local, pool, queue = Promise.resolve();
  if (connectionString) {
    const { Pool } = await import('pg');
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    const ssl = process.env.PG_NO_SSL === '1' ? false : { ca: supabaseCa, rejectUnauthorized: true };
    pool = new Pool({ connectionString: url.toString(), ssl, max: process.env.VERCEL ? 1 : 4, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
  } else {
    if (process.env.VERCEL) throw new Error('DATABASE_URL no configurada');
    const { DatabaseSync } = await import('node:sqlite');
    mkdirSync(dirname(path), { recursive: true });
    local = new DatabaseSync(path);
    local.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  }
  async function exclusive(fn) {
    const previous = queue; let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await fn(); } finally { release(); }
  }
  async function raw(sql, params=[]) {
    if (pool) { let index=0; return (await (context.getStore() || pool).query(sql.replace(/\?/g,()=>'$'+(++index)),params)).rows; }
    const stmt=local.prepare(sql);
    return (/^(SELECT|WITH|PRAGMA)/i.test(sql.trim())||/RETURNING/i.test(sql)) ? stmt.all(...params) : (stmt.run(...params), []);
  }
  const query = (sql,params=[]) => local && !context.getStore() ? exclusive(()=>raw(sql,params)) : raw(sql,params);
  const one = async (sql,params=[]) => (await query(sql,params))[0];
  async function transaction(fn) {
    if(context.getStore()) return fn();
    if(pool) {
      const client=await pool.connect();
      try { await client.query('BEGIN'); const result=await context.run(client,fn); await client.query('COMMIT'); return result; }
      catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
    }
    return exclusive(async()=>{local.exec('BEGIN IMMEDIATE');try{const result=await context.run(true,fn);local.exec('COMMIT');return result;}catch(error){local.exec('ROLLBACK');throw error;}});
  }
  for(const sql of [
    'CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(collection,id))',
    'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS config (id TEXT PRIMARY KEY,body TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires BIGINT NOT NULL)',
  ]) await query(sql);
  const put=async(c,item)=>query('INSERT INTO records(collection,id,body) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET body=excluded.body',[c,item.id,JSON.stringify(item)]);
  const config=async(id,body)=>query('INSERT INTO config(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',[id,JSON.stringify(body)]);
  async function state(){
    const result=Object.fromEntries(COLLECTIONS.map(c=>[c,[]]));
    for(const row of await query('SELECT * FROM records ORDER BY id')) result[row.collection]?.push(JSON.parse(row.body));
    result.activities.sort((a,b)=>String(b.date).localeCompare(String(a.date))).splice(200);
    result.settings=JSON.parse((await one("SELECT body FROM config WHERE id='settings'"))?.body || '{}');
    return result;
  }
  async function catalogMigration() {
    if(await one('SELECT id FROM config WHERE id=?',[catalog.version])) return;
    for(const c of ['offers','profiles']) for(const item of catalog[c]) await query('INSERT INTO records(collection,id,body) VALUES(?,?,?) ON CONFLICT(collection,id) DO NOTHING',[c,item.id,JSON.stringify(item)]);
    await config(catalog.version,true);
  }
  async function initialize(){const seed=createSeed();for(const c of COLLECTIONS) for(const item of seed[c]) await put(c,item);await config('settings',seed.settings);await catalogMigration();}
  if(await one('SELECT id FROM users LIMIT 1')) await transaction(catalogMigration);
  async function save(collection,data,id,user){
    // shortcut: concurrent edits are last-write-wins; add an updatedAt precondition if the team grows.
    return transaction(async()=>{
      if(collection==='prospects'&&id&&pool)await query('SELECT id FROM records WHERE collection=? AND id=? FOR UPDATE',[collection,id]);
      const row=id && await one('SELECT body FROM records WHERE collection=? AND id=?',[collection,id]);
      const prev=row?JSON.parse(row.body):null;const now=new Date().toISOString();
      const item={...data,id:id||randomUUID(),createdAt:prev?.createdAt||now,updatedAt:now};
      if(collection==='quotes'){item.ownerId=prev?.ownerId||user.id;item.owner=prev?.owner||user.name;}
      if(collection==='prospects'){item.history=prev?.history||[];item.stageChangedAt=prev?.stage===item.stage?prev.stageChangedAt:today();if(item.stage==='Ganado')item.probability=100;if(item.stage==='Perdido')item.probability=0;}
      await put(collection,item);
      if(collection==='prospects'){
        for(const[c,effect]of wonEffects(await state(),item,randomUUID))await put(c,effect);
        await put('activities',{id:randomUUID(),name:`${prev?'Actualizado':'Creado'}: ${item.name}${item.stage&&prev?.stage!==item.stage?' → '+item.stage:''}`,type:'Cambio',market:item.market||'Todos',owner:user.name,date:today(),prospectId:item.id});
      }
      return item;
    });
  }
  async function setupLock(){if(pool)await query('LOCK TABLE users IN EXCLUSIVE MODE');}
  return {query,one,config,state,put,save,transaction,initialize,setupLock,close:async()=>pool?pool.end():local.close()};
}
