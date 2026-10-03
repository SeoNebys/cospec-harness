'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { normalizeUrl, plainText } = require('./core');

const PORT = Number(process.env.PORT || 4000);
const ROOT = __dirname;
const DATA = process.env.TROVE_DATA_DIR || path.join(ROOT, 'data');
const CAPTURES = path.join(DATA, 'captures');
const STATE_FILE = path.join(DATA, 'state.json');
fs.mkdirSync(CAPTURES, { recursive: true });

const initialState = {
  bookmarks: [
    { id:'recipe', url:'https://www.seriouseats.com/the-best-roast-potatoes-ever-recipe', normalizedUrl:'https://www.seriouseats.com/the-best-roast-potatoes-ever-recipe', site:'Serious Eats', title:'Recipes I want to try', description:'The crispiest roast potatoes, with a fluffy center and plenty of flavor.', image:'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=80', labels:['Cooking','Weekend'], noteHtml:'Try the <strong>crispy roast potatoes</strong> for Sunday dinner<ul><li>Buy rosemary</li><li>Use the big roasting tray</li></ul>', pageText:'The secret to crisp roast potatoes is roughing up their edges before roasting. Sunday dinner planning and cooking notes.', createdAt:'2024-11-02T10:00:00.000Z', capturedAt:'2024-11-02T10:00:00.000Z', readStatus:'finished', archived:false, personalizedTitle:true, personalizedDescription:true },
    { id:'pasta', url:'https://example.com/weeknight-pasta', normalizedUrl:'https://example.com/weeknight-pasta', site:'Kitchen Notes', title:'Weeknight pasta guide', description:'Fast pasta techniques for busy evenings.', image:'https://images.unsplash.com/photo-1556761223-4c4282c73f77?auto=format&fit=crop&w=900&q=80', labels:['Cooking'], noteHtml:'', pageText:'Pasta sauces, pantry staples, and timing for an easy weeknight meal.', createdAt:'2025-03-14T18:00:00.000Z', capturedAt:'2025-03-14T18:00:00.000Z', readStatus:'finished', archived:false },
    { id:'design', url:'https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Flexbox', normalizedUrl:'https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Flexbox', site:'MDN', title:'Flexbox — Learn web development', description:'A complete guide to flexible page layout.', image:'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80', labels:['Research','Work'], noteHtml:'Useful examples for the redesign.', pageText:'Flexbox is a one-dimensional layout method for arranging items in rows or columns. Good visual hierarchy makes interfaces easier to understand.', createdAt:'2025-08-22T09:00:00.000Z', capturedAt:'2025-08-22T09:00:00.000Z', readStatus:'finished', archived:false },
    { id:'lemon', url:'https://example.com/one-pot-lemon-pasta', normalizedUrl:'https://example.com/one-pot-lemon-pasta', site:'Dinner Journal', title:'One-pot lemon pasta', description:'A bright, simple pasta for a relaxed weekend.', image:'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80', labels:['Cooking','Weekend'], noteHtml:'', pageText:'Creamy lemon pasta made in one pot.', createdAt:new Date().toISOString(), capturedAt:new Date().toISOString(), readStatus:'later', archived:false }
  ],
  savedSearches:[{ id:'pasta-weekends', name:'Pasta weekends', query:'pasta AND #weekend' }],
  preferences:{ pageSize:24, order:'newest', textSize:'comfortable' }
};

function readState() {
  if (!fs.existsSync(STATE_FILE)) fs.writeFileSync(STATE_FILE, JSON.stringify(initialState, null, 2));
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return structuredClone(initialState); }
}
function writeState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }
function json(res, status, body) { const data = JSON.stringify(body); res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(data)}); res.end(data); }
function body(req) { return new Promise((resolve, reject) => { const chunks=[]; let length=0; req.on('data', c => { length += c.length; if(length > 55_000_000) reject(new Error('Request too large')); else chunks.push(c); }); req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch(e) { reject(e); } }); req.on('error', reject); }); }
function attr(html, names) {
  for (const name of names) {
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const a=new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,'i').exec(html);
    const b=new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,'i').exec(html);
    if (a || b) return (a || b)[1].replace(/&amp;/g,'&');
  }
  return '';
}
async function capture(address) {
  const normalizedUrl=normalizeUrl(address); const target=new URL(address);
  const response=await fetch(address,{redirect:'follow',headers:{'User-Agent':'Trove personal bookmark archiver/1.0'}});
  if(!response.ok) throw new Error(`The page responded with ${response.status}.`);
  const contentType=response.headers.get('content-type') || '';
  const id=crypto.randomUUID(); const now=new Date().toISOString();
  if(contentType.includes('application/pdf') || target.pathname.toLowerCase().endsWith('.pdf')) {
    const bytes=Buffer.from(await response.arrayBuffer()); const file=`${id}.pdf`; fs.writeFileSync(path.join(CAPTURES,file),bytes);
    const strings=bytes.toString('latin1').match(/[A-Za-z][A-Za-z0-9 ,.:'"()\/-]{4,}/g) || [];
    return { normalizedUrl, site:target.hostname.replace(/^www\./,''), title:decodeURIComponent(path.basename(target.pathname)) || 'Saved PDF', description:'', image:'', pageText:strings.join(' ').slice(0,250000), capturePath:`/captures/${file}`, captureKind:'pdf', captureSize:bytes.length, capturedAt:now };
  }
  const html=await response.text(); const file=`${id}.html`;
  const safeHtml=html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<iframe\b[\s\S]*?<\/iframe>/gi,'').replace(/\son\w+\s*=\s*(["']).*?\1/gi,'').replace(/<head([^>]*)>/i,`<head$1><base href="${address.replace(/"/g,'&quot;')}">`);
  fs.writeFileSync(path.join(CAPTURES,file),safeHtml);
  const title=attr(html,['og:title','twitter:title']) || (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').replace(/\s+/g,' ').trim();
  const description=attr(html,['og:description','description','twitter:description']);
  const rawImage=attr(html,['og:image','twitter:image']);
  let image=''; try { if(rawImage) image=new URL(rawImage,address).toString(); } catch {}
  return { normalizedUrl, site:attr(html,['og:site_name']) || target.hostname.replace(/^www\./,''), title, description, image, pageText:plainText(html).slice(0,500000), capturePath:`/captures/${file}`, captureKind:'page', captureSize:Buffer.byteLength(html), capturedAt:now };
}
function browserExport(state) {
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  let out='<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Trove bookmarks</TITLE>\n<H1>Trove bookmarks</H1>\n<DL><p>\n';
  const link=b=>`    <DT><A HREF="${esc(b.url)}" ADD_DATE="${Math.floor(new Date(b.createdAt).getTime()/1000)}" TAGS="${esc((b.labels||[]).join(','))}">${esc(b.title)}</A>\n`;
  const labels=[...new Set(state.bookmarks.flatMap(b=>b.labels||[]))].sort();
  for(const label of labels){out+=`  <DT><H3>${esc(label)}</H3>\n  <DL><p>\n`;for(const b of state.bookmarks.filter(x=>(x.labels||[]).includes(label)))out+=link(b);out+='  </DL><p>\n'}
  for(const b of state.bookmarks.filter(x=>!(x.labels||[]).length))out+=link(b);
  return out+'</DL><p>\n';
}
async function api(req,res,url) {
  if(req.method==='GET' && url.pathname==='/api/state') return json(res,200,readState());
  if(req.method==='PUT' && url.pathname==='/api/state') { const state=await body(req); writeState(state); return json(res,200,{saved:true}); }
  if(req.method==='POST' && url.pathname==='/api/capture') { try { return json(res,200,await capture((await body(req)).url)); } catch(e) { return json(res,200,{error:e.message}); } }
  if(req.method==='POST' && url.pathname==='/api/capture/delete') { const requested=(await body(req)).path||'';const name=path.basename(requested);if(name&&requested===`/captures/${name}`){const file=path.join(CAPTURES,name);if(fs.existsSync(file))fs.unlinkSync(file)}return json(res,200,{deleted:true}); }
  if(req.method==='GET' && url.pathname==='/api/export/browser') { const data=browserExport(readState()); res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="trove-bookmarks.html"'}); return res.end(data); }
  if(req.method==='GET' && url.pathname==='/api/export/complete') {
    const state=readState(); const captures={}; const retained=new Set(state.bookmarks.map(b=>b.capturePath&&path.basename(b.capturePath)).filter(Boolean)); for(const file of retained) if(fs.existsSync(path.join(CAPTURES,file))) captures[file]=fs.readFileSync(path.join(CAPTURES,file)).toString('base64');
    const data=zlib.gzipSync(JSON.stringify({format:'Trove portable collection 1',exportedAt:new Date().toISOString(),state,captures}));
    res.writeHead(200,{'Content-Type':'application/gzip','Content-Disposition':'attachment; filename="trove-complete-backup.json.gz"'}); return res.end(data);
  }
  json(res,404,{error:'Not found'});
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost'); if(url.pathname.startsWith('/api/')) return await api(req,res,url);
    let file;
    if(url.pathname.startsWith('/captures/')) file=path.join(CAPTURES,path.basename(url.pathname));
    else file=path.join(ROOT,'public',url.pathname==='/'?'index.html':url.pathname);
    if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}); fs.createReadStream(file).pipe(res);
  } catch(e) { console.error(e); json(res,500,{error:'Something went wrong.'}); }
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Trove listening on http://0.0.0.0:${PORT}`));
