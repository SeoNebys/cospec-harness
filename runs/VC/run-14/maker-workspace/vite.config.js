import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dns from 'node:dns/promises';
import net from 'node:net';

const decode = (value = '') => value
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ').trim();
const privateAddress = ip => {
  if (net.isIPv4(ip)) { const [a,b] = ip.split('.').map(Number); return a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168); }
  return ip==='::1'||ip.startsWith('fc')||ip.startsWith('fd')||ip.startsWith('fe80:');
};
const attr = (tag, name) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || '';
function readMetadata(html, pageUrl) {
  const metas=html.match(/<meta\b[^>]*>/gi)||[], links=html.match(/<link\b[^>]*>/gi)||[];
  const getMeta = names => { for (const tag of metas) { const key=(attr(tag,'property')||attr(tag,'name')).toLowerCase(); if(names.includes(key)&&attr(tag,'content')) return decode(attr(tag,'content')); } return ''; };
  const titleTag=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
  let icon=''; for(const tag of links){if(/\b(?:shortcut\s+)?icon\b/i.test(attr(tag,'rel'))&&attr(tag,'href')){icon=attr(tag,'href');break;}}
  const resolve=value=>{try{return new URL(value,pageUrl).href}catch{return ''}};
  return {title:getMeta(['og:title','twitter:title'])||decode(titleTag),description:getMeta(['og:description','twitter:description','description']),icon:resolve(icon)||resolve('/favicon.ico')};
}
function metadataPlugin(){return{name:'bookmark-metadata',configureServer(server){server.middlewares.use('/api/metadata',async(req,res)=>{res.setHeader('Content-Type','application/json');try{
  const input=new URL(req.url,'http://local').searchParams.get('url'); if(!input)throw new Error('A URL is required.');
  const target=new URL(input); if(!['http:','https:'].includes(target.protocol))throw new Error('Only web links are supported.');
  const addresses=await dns.lookup(target.hostname,{all:true}); if(!addresses.length||addresses.some(x=>privateAddress(x.address)))throw new Error('That address cannot be fetched.');
  const response=await fetch(target,{redirect:'follow',signal:AbortSignal.timeout(8000),headers:{'user-agent':'Bookmarked/1.0 metadata preview',accept:'text/html,application/xhtml+xml'}});
  if(!response.ok)throw new Error(`The page returned ${response.status}.`); const type=response.headers.get('content-type')||''; if(!type.includes('text/html')&&!type.includes('application/xhtml+xml'))throw new Error('This link is not an HTML page.');
  const reader=response.body.getReader();let total=0;const chunks=[];while(total<1_000_000){const{done,value}=await reader.read();if(done)break;chunks.push(value);total+=value.length;}
  const html=new TextDecoder().decode(Buffer.concat(chunks));res.end(JSON.stringify({...readMetadata(html,response.url),url:response.url}));
}catch(error){res.statusCode=422;res.end(JSON.stringify({error:error.name==='TimeoutError'?'The page took too long to respond.':error.message}));}});}}}
export default defineConfig({plugins:[react(),metadataPlugin()]});
