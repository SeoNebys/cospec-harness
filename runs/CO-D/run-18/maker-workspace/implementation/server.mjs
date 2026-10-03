import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BookmarkStore, canonicalTag, normalizeUrl } from './store.mjs';
import { fetchMetadata } from './metadata.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(here,'public');
const dataFile=process.env.BOOKMARK_DATA || path.join(here,'data','bookmarks.json');
const port=Number(process.env.PORT || 4000);
const store=new BookmarkStore(dataFile); await store.load();

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const send=(res,status,data,type='application/json; charset=utf-8')=>{ res.writeHead(status,{'content-type':type,'cache-control':'no-store'}); res.end(type.startsWith('application/json')?JSON.stringify(data):data); };
async function body(req){ let text=''; for await(const chunk of req){ text+=chunk; if(text.length>1_000_000) throw new Error('Request too large'); } return text?JSON.parse(text):{}; }
function error(res,error){ const status=error.code==='DUPLICATE'?409:400; send(res,status,{error:error.message,code:error.code}); }

const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://local');
    if(url.pathname==='/api/bookmarks' && req.method==='GET') return send(res,200,{bookmarks:store.all(),tags:store.tags()});
    if(url.pathname==='/api/preview' && req.method==='POST') {
      const input=await body(req); let normalized;
      try { normalized=normalizeUrl(input.url); } catch { return send(res,400,{error:'Enter a complete web address, such as https://example.com.'}); }
      const existing=store.findByUrl(input.url); if(existing) return send(res,200,{duplicate:existing});
      try { return send(res,200,{preview:await fetchMetadata(input.url),normalized}); }
      catch { return send(res,422,{error:'The address is valid, but the page did not respond.',manual:true,normalized}); }
    }
    if(url.pathname==='/api/bookmarks' && req.method==='POST') return send(res,201,{bookmark:await store.create(await body(req))});
    const match=url.pathname.match(/^\/api\/bookmarks\/([^/]+)$/);
    if(match && req.method==='PUT') { const item=await store.update(match[1],await body(req)); return item?send(res,200,{bookmark:item}):send(res,404,{error:'Bookmark not found'}); }
    if(match && req.method==='DELETE') { const count=await store.deleteArchived([match[1]]); return send(res,200,{deleted:count}); }
    if(url.pathname==='/api/bulk' && req.method==='POST') { const input=await body(req); return send(res,200,{bookmarks:await store.bulk(input.ids,input.action,input.value)}); }
    if(url.pathname==='/api/bulk-delete' && req.method==='POST') { const input=await body(req); return send(res,200,{deleted:await store.deleteArchived(input.ids)}); }
    if(url.pathname==='/api/tags/canonical' && req.method==='POST') { const input=await body(req); return send(res,200,{tag:canonicalTag(input.tag,store.tags())}); }
    if(url.pathname==='/api/refresh-preview' && req.method==='POST') { const input=await body(req); return send(res,200,{preview:await fetchMetadata(input.url)}); }
    const relative=url.pathname==='/'?'index.html':url.pathname.replace(/^\//,'');
    const target=path.resolve(publicDir,relative);
    if(!target.startsWith(publicDir)) return send(res,403,{error:'Forbidden'});
    try { const content=await readFile(target); return send(res,200,content,mime[path.extname(target)] || 'application/octet-stream'); }
    catch { return send(res,404,'Not found','text/plain; charset=utf-8'); }
  } catch(err){ error(res,err); }
});

server.listen(port,'0.0.0.0',()=>console.log(`Keepsake listening on 0.0.0.0:${port}`));
export { server, store };
