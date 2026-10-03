import { compileSearch } from './search.js';

const $ = selector => document.querySelector(selector);
const state = { bookmarks: [], status: 'read', label: 'all', query: '', editing: null };
const api = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'content-type': 'application/json' }, ...options });
  const type = response.headers.get('content-type') || '';
  const body = type.includes('json') ? await response.json() : await response.text();
  if (!response.ok) throw Object.assign(new Error(body.error || body), { status: response.status, body });
  return body;
};
const searchItem = item => ({ labels: item.labels, searchText: [item.title,item.description,item.source,item.note].join(' ').toLocaleLowerCase() });
const labels = () => [...new Map(state.bookmarks.flatMap(x => x.labels).map(x => [x.toLocaleLowerCase(), x])).values()].sort((a,b)=>a.localeCompare(b));

function renderLabels() {
  $('#labels').innerHTML = '';
  for (const label of ['all', ...labels()]) {
    const button = document.createElement('button'); button.textContent = label === 'all' ? 'All' : label;
    button.classList.toggle('active', state.label === label.toLocaleLowerCase());
    button.onclick = () => { state.label = label.toLocaleLowerCase(); render(); };
    $('#labels').append(button);
  }
  $('#label-options').innerHTML = labels().map(x => `<option value="${escapeHtml(x)}"></option>`).join('');
}

function filtered() {
  const byStatus = state.bookmarks.filter(x => x.status === state.status);
  let matcher;
  try { matcher = compileSearch(state.query); $('#summary').classList.remove('error'); }
  catch (error) { $('#summary').textContent = `${error.message} Your collection has not changed.`; $('#summary').classList.add('error'); return { items: byStatus.filter(x => state.label === 'all' || x.labels.some(y => y.toLocaleLowerCase() === state.label)), invalid: true }; }
  return { items: byStatus.filter(x => (state.label === 'all' || x.labels.some(y => y.toLocaleLowerCase() === state.label)) && matcher(searchItem(x))), invalid: false };
}

function render() {
  renderLabels();
  const read = state.bookmarks.filter(x => x.status === 'read').length, done = state.bookmarks.length - read;
  $('[data-status="read"] span').textContent = read; $('[data-status="done"] span').textContent = done;
  document.querySelectorAll('[data-status]').forEach(x => x.classList.toggle('active', x.dataset.status === state.status));
  const result = filtered(), root = $('#cards'); root.innerHTML = '';
  for (const item of result.items) root.append(renderCard(item));
  $('#visible-count').textContent = result.items.length;
  const empty = $('#empty');
  if (!result.items.length && !result.invalid) {
    empty.hidden = false; const title = empty.querySelector('h2'), text = empty.querySelector('p'), button = empty.querySelector('button');
    if (state.query || state.label !== 'all') { title.textContent = 'No matching bookmarks'; text.textContent = 'Your collection is still here. Try changing or clearing this search.'; button.hidden = false; button.textContent = 'Clear search and label'; button.onclick = () => { state.query='';state.label='all';$('#search').value='';render(); }; }
    else { title.textContent = state.status === 'done' ? 'Nothing in Done yet' : 'No To read bookmarks'; text.textContent = state.status === 'done' ? 'Bookmarks you finish will collect here. Your To read links are unchanged.' : 'Save a link above or move one back from Done.'; button.hidden = false; button.textContent = state.status === 'done' ? 'View To read' : 'View Done'; button.onclick=()=>{state.status=state.status==='done'?'read':'done';render()}; }
  } else empty.hidden = true;
  if (!result.invalid) $('#summary').textContent = state.query ? `Showing ${result.items.length} matching bookmark${result.items.length===1?'':'s'}.` : `Showing ${result.items.length} ${state.status === 'read' ? 'To read' : 'Done'} bookmark${result.items.length===1?'':'s'}.`;
  document.querySelector('main').setAttribute('data-harness-ready','true');
}

function renderCard(item) {
  const card = $('#card-template').content.firstElementChild.cloneNode(true); card.dataset.id = item.id; card.tabIndex = 0;
  card.querySelector('.status').textContent = item.status === 'read' ? 'To read' : 'Done';
  const link = card.querySelector('h2 a'); link.textContent = item.title; link.href = item.url;
  card.onclick = event => { if (!event.target.closest('button,input,a')) window.open(item.url, '_blank', 'noopener'); };
  card.onkeydown = event => { if ((event.key === 'Enter' || event.key === ' ') && event.target === card) { event.preventDefault(); window.open(item.url, '_blank', 'noopener'); } };
  card.querySelector('.description').textContent = item.description;
  card.querySelector('.source').textContent = item.source;
  if (item.note) { card.querySelector('.note-wrap').hidden = false; card.querySelector('.note').textContent = item.note; }
  const long = (item.description.length + item.note.length) > 240, more = card.querySelector('.show-more'); more.hidden = !long;
  more.onclick = () => { const box=card.querySelector('.long-text');box.classList.toggle('expanded');more.textContent=box.classList.contains('expanded')?'Show less':'Show more'; };
  const chips = card.querySelector('.chips');
  for (const label of item.labels) { const b=document.createElement('button');b.className='chip';b.textContent=label;b.onclick=()=>{state.label=label.toLocaleLowerCase();render()};chips.append(b); }
  card.querySelector('.edit').onclick=()=>openEditor(item);
  const toggle=card.querySelector('.toggle');toggle.textContent=item.status==='read'?'Mark done':'Move to To read';toggle.onclick=async()=>{await api(`/api/bookmarks/${item.id}/status`,{method:'PATCH',body:JSON.stringify({status:item.status==='read'?'done':'read'})});await load();};
  const labelInput=card.querySelector('.quick-label input');card.querySelector('.quick-label button').onclick=async()=>{if(!labelInput.value.trim())return;const out=await api(`/api/bookmarks/${item.id}/labels`,{method:'POST',body:JSON.stringify({label:labelInput.value})});$('#save-message').textContent=out.reused?'Existing label reused with its established spelling.':'Label added.';await load();};
  const snapshot=card.querySelector('.snapshot-line');
  if(item.snapshotStatus==='ready'){snapshot.innerHTML='Saved with page copy · <button>Open copy</button>';snapshot.querySelector('button').onclick=()=>openSnapshot(item);}
  else{snapshot.classList.add('failed');snapshot.innerHTML='Page copy unavailable · <button>Try again</button>';snapshot.querySelector('button').onclick=async()=>{try{await api(`/api/bookmarks/${item.id}/snapshot/retry`,{method:'POST'});$('#save-message').textContent='Readable page copy captured.';await load();}catch(e){$('#save-message').textContent=e.message;$('#save-message').className='message warning';}};}
  return card;
}

function openEditor(item) {
  state.editing=item.id;$('#edit-title').value=item.title;$('#edit-description').value=item.description;$('#edit-url').value=item.url;$('#edit-note').value=item.note;$('#edit-labels').value=item.labels.join(', ');$('#edit-error').textContent='';$('#editor').classList.add('open');$('#editor').setAttribute('aria-hidden','false');$('#shade').classList.add('open');$('#edit-title').focus();
}
function closeEditor(){state.editing=null;$('#editor').classList.remove('open');$('#editor').setAttribute('aria-hidden','true');$('#shade').classList.remove('open');$('#edit-error').textContent='';}
async function saveEditor(){try{const body={title:$('#edit-title').value,description:$('#edit-description').value,url:$('#edit-url').value,note:$('#edit-note').value,labels:$('#edit-labels').value.split(',').map(x=>x.trim()).filter(Boolean)};await api(`/api/bookmarks/${state.editing}`,{method:'PUT',body:JSON.stringify(body)});closeEditor();await load();}catch(error){$('#edit-error').textContent=error.message;$('#edit-url').focus();}}
function openSnapshot(item){const d=$('#snapshot');d.querySelector('iframe').src=`/api/bookmarks/${item.id}/snapshot`;d.showModal();}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}

async function load(){state.bookmarks=await api('/api/bookmarks');render();}
$('#save-form').onsubmit=async event=>{event.preventDefault();const input=$('#save-url'),message=$('#save-message');message.className='message';message.textContent='Saving the link and capturing a readable copy…';try{const out=await api('/api/bookmarks',{method:'POST',body:JSON.stringify({url:input.value})});input.value='';message.textContent=out.detailsLoaded?'Saved with its page details.':'Link saved, but its page details could not be loaded.';message.classList.toggle('warning',!out.detailsLoaded);await load();}catch(error){message.textContent=error.message;message.classList.add(error.status===409?'warning':'error');if(error.body?.existing){state.status=error.body.existing.status;await load();const card=document.querySelector(`[data-id="${error.body.existing.id}"]`);card?.scrollIntoView({behavior:'smooth',block:'center'});card?.classList.add('recalled');}}};
$('#search').oninput=event=>{state.query=event.target.value;render()};document.querySelectorAll('[data-status]').forEach(x=>x.onclick=()=>{state.status=x.dataset.status;render()});$('#close-edit').onclick=closeEditor;$('#cancel-edit').onclick=closeEditor;$('#shade').onclick=closeEditor;$('#save-edit').onclick=saveEditor;$('#snapshot .dialog-head button').onclick=()=>{$('#snapshot').close();$('#snapshot iframe').src='about:blank'};
load().catch(error=>{$('#summary').textContent=`Link Home could not load: ${error.message}`;$('#summary').classList.add('error')});
