import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {baseState} from '../shared/domain.mjs';
import {zodMessages} from '../shared/errors.mjs';
import {schemas,settingsSchema} from '../server/schema.mjs';
import type {Collection,Entity,Settings,State,User} from './types';
export async function api(path:string,method='GET',body?:unknown){
 const res=await fetch('/api'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 let data;try{data=await res.json();}catch{throw new Error('El servidor no está disponible. Intenta nuevamente.');}
 if(!res.ok){if(res.status===401&&path!=='/login')window.dispatchEvent(new Event('pz-session-expired'));throw new Error(data.error||'No se pudo completar la operación.');}return data;
}
const Context=createContext<any>(null);
function parse(schema:{safeParse:(v:unknown)=>any},v:unknown):Record<string,any>{
 const r=schema.safeParse(v);
 if(!r.success)throw new Error(zodMessages(r.error));
 return r.data;
}
export function StoreProvider({children}:{children:ReactNode}){
 const[state,setState]=useState<State>(()=>baseState() as State);
 const[user,setUser]=useState<User|null>(null);const[ready,setReady]=useState(false);const[configured,setConfigured]=useState(true);const[setupProtected,setSetupProtected]=useState(false);const[connectionError,setConnectionError]=useState('');const[toast,setToast]=useState('');
 const refreshTicket=useRef(0);
 function notify(s:string){setToast(s);}
 async function initialize(){setConnectionError('');try{const r=await api('/session');setConfigured(r.configured);setSetupProtected(r.setupProtected);if(r.user){setState(await api('/state'));setUser(r.user);}}catch(e:any){setConnectionError(e.message);}finally{setReady(true);}}
 useEffect(()=>{initialize();const expired=()=>{setUser(null);setState(baseState() as State);};window.addEventListener('pz-session-expired',expired);return()=>window.removeEventListener('pz-session-expired',expired);},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t);},[toast]);
 async function authenticate(mode:string,data:unknown){const u=await api(mode==='setup'?'/setup':'/login','POST',data);setState(await api('/state'));setUser(u);setConfigured(true);notify('Bienvenido a tu espacio de trabajo.');}
 async function refresh(){const ticket=++refreshTicket.current;const next=await api('/state');if(ticket===refreshTicket.current)setState(next);}
 function refreshLater(){const ticket=++refreshTicket.current;api('/state').then(next=>{if(ticket===refreshTicket.current)setState(next);}).catch(()=>{if(ticket===refreshTicket.current)notify('No se pudo actualizar la vista; recarga la página.');});}
 function replaceInState(c:Collection,item:Entity,existing?:Entity){
  setState(prev=>{
   const list=(prev[c]||[]) as Entity[];
   const next=existing
    ? list.some(x=>x.id===item.id)
      ? list.map(x=>x.id===item.id?item:x)
      : [item,...list]
    : [item,...list];
   return {...prev,[c]:next};
  });
 }
 async function logout(){await api('/logout','POST',{});setUser(null);setState(baseState() as State);notify('Sesión cerrada.');}
 async function save(c:Collection,v:Record<string,any>,item?:Entity){const clean=parse(schemas[c],v);const result=await api(`/${c}${item?'/'+item.id:''}`,item?'PUT':'POST',clean);replaceInState(c,result,item);notify(item?'Cambios guardados.':'Registro creado.');refreshLater();return result;}
 async function remove(c:Collection,item:Entity){await api(`/${c}/${item.id}`,'DELETE',{});setState(prev=>({...prev,[c]:((prev[c]||[]) as Entity[]).filter(x=>x.id!==item.id)}));notify('Registro eliminado.');refreshLater();}
 async function activity(p:Entity,v:Record<string,any>){const result=await api('/activities','POST',{...v,prospectId:p.id});setState(prev=>({...prev,activities:[result,...(prev.activities||[])],prospects:prev.prospects.map(x=>x.id===result.prospectId?{...x,updatedAt:new Date().toISOString(),history:[...(x.history||[]),{id:result.id,type:result.type,text:result.name,date:result.date,author:result.owner}]}:x)}));notify('Actividad registrada.');refreshLater();}
 async function updateSettings(v:Settings){const clean=parse(settingsSchema,v);const result=await api('/settings','PUT',clean);setState(prev=>({...prev,settings:result}));notify('Configuración guardada.');refreshLater();}
 return <Context.Provider value={{state,user,ready,configured,setupProtected,connectionError,initialize,toast,notify,save,remove,activity,authenticate,logout,updateSettings,refresh}}>{children}</Context.Provider>;
}
export const useStore=()=>useContext(Context) as {state:State;user:User|null;ready:boolean;configured:boolean;setupProtected:boolean;connectionError:string;initialize:()=>Promise<void>;toast:string;notify:(s:string)=>void;save:(c:Collection,v:Record<string,any>,i?:Entity)=>Promise<Entity>;remove:(c:Collection,i:Entity)=>Promise<void>;activity:(p:Entity,v:Record<string,any>)=>Promise<void>;authenticate:(m:string,d:unknown)=>Promise<void>;logout:()=>Promise<void>;updateSettings:(s:Settings)=>Promise<void>;refresh:()=>Promise<void>};
