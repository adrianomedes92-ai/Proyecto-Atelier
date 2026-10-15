import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=process.cwd();
http.createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+'/'))throw Error();if(path.includes('/.')||!['.html','.css','.js','.svg','.jpg','.png','.webp'].includes(extname(path))&&path!==root)throw Error();const file=path===root?root+'/index.html':path;const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404);res.end('No encontrado')}}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Proyecto Atelier iniciado en puerto '+(process.env.PORT||3000)));
