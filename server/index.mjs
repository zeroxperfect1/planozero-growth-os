import {app,getStore} from './app.mjs';
import express from 'express';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.env.NODE_ENV==='production'){app.use(express.static(join(root,'dist')));app.get('/{*path}',(_req,res)=>res.sendFile(join(root,'dist/index.html')));}
else{const{createServer}=await import('vite');const vite=await createServer({root,server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
const port=Number(process.env.PORT||5173);
const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`PLANOZERO Growth OS → http://localhost:${port}`));
process.on('SIGTERM',()=>server.close(async()=>{await(await getStore()).close();process.exit(0);}));
