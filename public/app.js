import {createPacket,parsePacket,savePacket,loadSaved,deleteSaved,listSaved} from './review-store.js';
const $ = id => document.getElementById(id);
const beforeEditor = $('base');
const afterEditor = $('revision');
const status = $('status');
let lastReview = null;
let completed = new Set();
let triage = new Map();
let analysisId = 0;
let currentReviewId = null;
let changedSinceSave = false;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}
function updateLengths() {
  $('base-size').textContent = beforeEditor.value.length.toLocaleString() + ' characters';
  $('revision-size').textContent = afterEditor.value.length.toLocaleString() + ' characters';
}
function invalidate() {
  lastReview = null;
  analysisId++;
  completed.clear();
  triage.clear();
  currentReviewId = null;
  changedSinceSave = false;
  $('save-feedback').textContent = 'Not saved · Export a file to share or back up.';
  $('results').hidden = true;
  $('compare').disabled = false;
  $('compare').textContent = 'Analyze release impact ↗';
  updateLengths();
}
function setEditors(a,b) {
  beforeEditor.value = a; afterEditor.value = b;
  invalidate();
}
function loadSample() {
  const common = {
    openapi: '3.0.3',
    info: { title: 'Commerce API', version: '1.0.0' },
    paths: {
      '/customers': { get: { summary: 'List customers', responses: { '200': { description: 'OK' } } } },
      '/orders': { post: { summary: 'Create an order', parameters: [{ name: 'region', in: 'query', required: false, schema: { type: 'string' } }], responses: { '201': { description: 'Created' } } } },
      '/legacy-report': { get: { summary: 'Legacy analytics', responses: { '200': { description: 'OK' } } } }
    }
  };
  const next = structuredClone(common);
  next.info.version = '2.0.0';
  delete next.paths['/legacy-report'];
  next.paths['/orders'].post.parameters[0].required = true;
  next.paths['/orders'].post.summary = 'Create an order for a region';
  next.paths['/health'] = { get: { summary: 'Check service health', responses: { '200': { description: 'Healthy' } } } };
  setEditors(JSON.stringify(common,null,2), JSON.stringify(next,null,2));
  setStatus('Example loaded. Comparing the release against the baseline…');
  runComparison();
}
function make(tag, cls, value) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (value != null) element.textContent = String(value);
  return element;
}
function empty(target, message) {
  target.replaceChildren(make('div','empty',message));
}
function displayVersion(overview) {
  const {base,revision} = overview;
  $('version-label').textContent = base.title + ' · v' + base.version + '  →  v' + revision.version;
}
function displayDecision(data) {
  const findings = data.findings;
  const count = findings.breakingCount;
  const box = $('decision');
  const title = $('decision-title');
  const description = $('decision-description');
  if (!findings.available) {
    box.dataset.level = 'unknown';
    title.textContent = 'Review required: structured findings unavailable';
    description.textContent = 'The raw oasdiff reports are available. Check them manually before deciding whether to release.';
  } else if (count > 0) {
    box.dataset.level = 'warning';
    title.textContent = count + ' potential breaking ' + (count === 1 ? 'change' : 'changes') + ' detected';
    description.textContent = 'Review every finding, identify affected consumers, and plan mitigations before release.';
  } else {
    box.dataset.level = 'ok';
    title.textContent = 'No breaking findings reported';
    description.textContent = 'The automated contract checks found no breaking changes. Still validate runtime behavior and client integration.';
  }
  $('decision-icon').textContent = count > 0 ? '!' : count === 0 ? '✓' : '?';
}
function applyStats(data) {
  const {counts} = data.overview;
  $('stat-added').textContent = counts.added;
  $('stat-removed').textContent = counts.removed;
  $('stat-edited').textContent = counts.edited;
  $('stat-breaking').textContent = data.findings.breakingCount ?? '—';
  $('finding-count').textContent = data.findings.totalCount ?? '—';
}
function renderEndpoints() {
  const target = $('endpoint-list');
  target.replaceChildren();
  if (!lastReview) return;
  const query = $('endpoint-query').value.trim().toLowerCase();
  const filter = $('endpoint-status').value;
  const filtered = lastReview.overview.endpoints.filter(item => {
    return (filter === 'all' || item.status === filter) &&
      (item.method + ' ' + item.path + ' ' + item.summary + ' ' + item.tags.join(' ')).toLowerCase().includes(query);
  });
  const max = 250;
  for (const item of filtered.slice(0,max)) {
    const row = make('div','endpoint-row');
    row.append(make('span','method ' + item.method.toLowerCase(), item.method));
    const detail = make('div','endpoint-main');
    detail.append(make('code','',item.path));
    if (item.summary) detail.append(make('small','',item.summary));
    row.append(detail);
    if (item.tags.length) row.append(make('span','tag',item.tags[0]));
    row.append(make('span','status-pill ' + item.status,item.status));
    target.append(row);
  }
  if (!filtered.length) empty(target,'No operations match this filter.');
  $('endpoint-summary').textContent = 'Showing ' + Math.min(filtered.length,max) + ' of ' + filtered.length +
    ' matched operations · Exact method/path comparison. Path renames appear as removed + added; the classification does not prove a breaking change.';
}
function findingKey(item) {
  return item.fingerprint || [item.id,item.method,item.path,item.message].join('|');
}
function updateTriageProgress() {
  if (!lastReview) return;
  const breakingItems = lastReview.findings.findings.filter(item => item.breaking);
  const handled = breakingItems.filter(item => {
    const disposition = triage.get(findingKey(item))?.disposition;
    return disposition && disposition !== 'open';
  }).length;
  $('triage-progress').textContent = breakingItems.length
    ? handled + ' / ' + breakingItems.length + ' breaking findings have a review decision. Add rationale for accepted exceptions.'
    : 'No structured breaking findings to triage. Review the raw engine report and release checklist.';
}
function renderFindings() {
  const target = $('finding-list');
  target.replaceChildren();
  if (!lastReview) return;
  const findings = lastReview.findings;
  const query = $('finding-query').value.trim().toLowerCase();
  const severity = $('finding-level').value;
  const filtered = findings.findings.filter(item => {
    return (severity === 'all' || item.severity === severity) &&
      (item.id + ' ' + item.message + ' ' + item.method + ' ' + item.path).toLowerCase().includes(query);
  });
  for (const item of filtered.slice(0,250)) {
    const row = make('div','finding-row');
    const body = make('div','finding-body');
    body.append(make('code','',item.id));
    body.append(make('p','',item.message || 'No description was provided by the analysis engine.'));
    if (item.method || item.path) body.append(make('small','',[item.method,item.path].filter(Boolean).join(' ')));
    row.append(make('span','status-pill ' + item.severity,item.severity));
    row.append(body);
    const reviewKey = findingKey(item);
    const saved = triage.get(reviewKey) || { disposition: 'open', note: '' };
    const detail = make('details', 'triage-details');
    if (saved.disposition !== 'open' || saved.note) detail.open = true;
    detail.append(make('summary', '', 'Review decision & rationale'));
    const controls = make('div', 'triage-controls');
    const decision = make('label', '', 'Decision');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Decision for ' + item.id);
    for (const [value, label] of [['open','Needs review'],['fix','Fix planned'],['accepted','Accepted with rationale'],['false-positive','Not applicable / false positive']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label;
      select.append(option);
    }
    select.value = saved.disposition;
    const noteLabel = make('label', '', 'Reviewer note');
    const note = document.createElement('textarea');
    note.rows = 2; note.maxLength = 600;
    note.placeholder = 'Evidence, ticket, owner, or why this is accepted…';
    note.value = saved.note;
    function save() {
      triage.set(reviewKey,{ disposition: select.value, note: note.value.slice(0,600) });
      updateTriageProgress();
      markReviewEdited();
    }
    select.addEventListener('change', save);
    note.addEventListener('input',save);
    decision.append(select);
    noteLabel.append(note);
    controls.append(decision,noteLabel);
    detail.append(controls);
    body.append(detail);
    target.append(row);
  }
  if (!filtered.length) {
    empty(target,findings.available ? 'No findings match this filter.' : 'Structured findings unavailable. See the raw oasdiff reports for a full review.');
  }
  updateTriageProgress();
  $('finding-summary').textContent = findings.available
    ? ('Showing ' + Math.min(filtered.length,250) + ' of ' + filtered.length + ' matching findings · Counts are from the oasdiff changelog and breaking analyses.')
    : 'The engine reports are available but structured findings were not returned. Do not interpret the empty list as a clean release.';
}
function renderChecklist() {
  if (!lastReview) return;
  const target = $('checklist-list');
  target.replaceChildren();
  for (const item of lastReview.checklist) {
    const label = make('label','checklist-row');
    const cb = document.createElement('input');
    cb.type='checkbox'; cb.value=item.id; cb.checked=completed.has(item.id);
    cb.addEventListener('change',() => {
      if (cb.checked) completed.add(item.id);
      else completed.delete(item.id);
      updateChecklistProgress();
      markReviewEdited();
    });
    label.append(cb,make('span','',item.label));
    target.append(label);
  }
  updateChecklistProgress();
}
function updateChecklistProgress() {
  if (!lastReview) return;
  $('checklist-progress').textContent = completed.size + ' / ' + lastReview.checklist.length + ' reviewed';
}
function renderRaw() {
  if (!lastReview) return;
  const mode = $('report-type').value;
  $('raw-output').textContent = lastReview[mode] || (mode === 'breaking' ? 'No potentially breaking changes in engine report.' : 'No consumer-facing changes in engine report.');
}
function showTab(name) {
  for (const tab of document.querySelectorAll('.tab')) {
    const active=tab.dataset.tab===name;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex = active ? 0 : -1;
    $('pane-'+tab.dataset.tab).hidden=!active;
  }
}
function renderReview(data) {
  lastReview = data; completed = new Set(); triage = new Map();
  currentReviewId = null; changedSinceSave = true;
  $('review-title').value = (data.overview.base.title + ' · ' + data.overview.base.version + ' → ' + data.overview.revision.version).slice(0,120);
  $('review-reviewer').value = '';
  $('save-feedback').textContent = 'Not saved · Export a file to share or back up.';
  $('results').hidden=false;
  displayVersion(data.overview);
  displayDecision(data);
  applyStats(data);
  $('endpoint-query').value=''; $('endpoint-status').value='all';
  $('finding-query').value=''; $('finding-level').value='all';
  renderEndpoints(); renderFindings(); renderChecklist(); renderRaw(); showTab('endpoints');
  $('results').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
async function runComparison() {
  const base = beforeEditor.value.trim(), revision=afterEditor.value.trim();
  if (!base || !revision) {setStatus('Paste both your baseline and revised API specifications.',true);return;}
  if (new TextEncoder().encode(base).length>409600 || new TextEncoder().encode(revision).length>409600) {
    setStatus('Each contract must be 400 KiB or smaller.',true);return;
  }
  const requestId=++analysisId;
  const button=$('compare');
  button.disabled=true; button.textContent='Analyzing contracts…'; $('results').hidden=true; lastReview=null;
  setStatus('Running the OpenAPI change analysis. This can take a moment…');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),28000);
  try {
    const response=await fetch('/api/compare',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base,revision}),signal:controller.signal
    });
    let data;
    try {data=await response.json();}catch{throw new Error('The analysis server returned an unexpected response.');}
    if (!response.ok) throw new Error(data.error || 'Unable to compare these specifications.');
    if (!data.overview || !data.findings || !Array.isArray(data.checklist)) throw new Error('The server returned an incomplete analysis.');
    if (requestId!==analysisId) return;
    renderReview(data); setStatus('Release analysis complete. Review the findings and prepare your release checklist.');
  } catch(error) {
    if(requestId===analysisId) setStatus(error?.name==='AbortError'?'Analysis timed out. Try smaller specs or retry.':(error?.message || 'Comparison failed.'),true);
  } finally {
    clearTimeout(timeout);
    if(requestId===analysisId){button.disabled=false;button.innerHTML='Analyze release impact <span aria-hidden="true">↗</span>';}
  }
}
function markdownReport(data) {
  const o=data.overview,f=data.findings;
  return [
    '# SchemaDiff Studio — Release Review',
    '',
    '**API:** '+o.base.title,
    '**Versions:** '+o.base.version+' → '+o.revision.version,
    '**Generated:** '+new Date().toISOString(),
    '**Review:** '+$('review-title').value.trim(),
    '**Reviewer:** '+($('review-reviewer').value.trim() || 'Not specified'),
    '',
    '## Review signal',
    f.breakingCount===null?'Structured breaking-change count unavailable; manually inspect the raw report.':f.breakingCount+' potential breaking findings reported by oasdiff.',
    '',
    '## Endpoint impact (exact method/path)',
    '- Added: '+o.counts.added,
    '- Removed: '+o.counts.removed,
    '- Edited: '+o.counts.edited,
    '- Unchanged: '+o.counts.unchanged,
    '',
    ...o.endpoints.filter(x=>x.status!=='unchanged').map(x=>'- **'+x.status.toUpperCase()+'** '+x.method+' '+x.path),
    '',
    '## Finding triage decisions',
    ...f.findings.filter(item=>item.breaking).map(item=>{
      const decision=triage.get(findingKey(item)) || {disposition:'open',note:''};
      return '- **'+decision.disposition.toUpperCase()+'** '+item.id+' '+item.method+' '+item.path + (decision.note?' — '+decision.note:'');
    }),
    '',
    '## Release checklist',
    ...data.checklist.map(item=>'- ['+(completed.has(item.id)?'x':' ')+'] '+item.label),
    '',
    '## Breaking-change report (oasdiff)',
    data.breaking || 'No potentially breaking findings reported in the Markdown output.',
    '',
    '## Consumer-facing changelog (oasdiff)',
    data.changelog || 'No changes reported in the Markdown output.',
    '',
    '---',
    'Generated by SchemaDiff Studio. Interpret findings alongside implementation and client testing.',
    ''
  ].join('\n');
}
function downloadText(text,filename,type) {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const link=document.createElement('a');
  link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function onFile(event,target) {
  const input=event.target,file=input.files?.[0];
  if (!file)return;
  try {
    if(file.size>409600)throw new Error('File exceeds the 400 KiB limit.');
    const content=await file.text();
    target.value=content;
    invalidate();
    setStatus('Loaded '+file.name+'. Upload the other version or analyze now.');
  } catch(e) {setStatus(e.message || 'Could not read this file.',true);}
  finally{input.value='';}
}
$('base-file').addEventListener('change',event=>onFile(event,beforeEditor));
$('revision-file').addEventListener('change',event=>onFile(event,afterEditor));
for(const input of [beforeEditor,afterEditor]){
  input.addEventListener('input',()=>{invalidate();setStatus('Contract changed. Analyze again to refresh the review.');});
}
$('sample').addEventListener('click',loadSample);
$('hero-sample').addEventListener('click',loadSample);
$('swap').addEventListener('click',()=>{setEditors(afterEditor.value,beforeEditor.value);setStatus('Contract order swapped. Analyze again to see the reversed change impact.');});
$('clear').addEventListener('click',()=>{setEditors('','');setStatus('Cleared. Paste or upload a baseline and revision to begin.');});
$('compare').addEventListener('click',runComparison);
$('endpoint-query').addEventListener('input',renderEndpoints);
$('endpoint-status').addEventListener('change',renderEndpoints);
$('finding-query').addEventListener('input',renderFindings);
$('finding-level').addEventListener('change',renderFindings);
$('report-type').addEventListener('change',renderRaw);
for(const tab of document.querySelectorAll('.tab'))tab.addEventListener('click',()=>showTab(tab.dataset.tab));
$('export-md').addEventListener('click',()=>{if(lastReview)downloadText(markdownReport(lastReview),'schemadiff-release-review.md','text/markdown;charset=utf-8');});
$('export-json').addEventListener('click',()=>{if(lastReview){
  const {overview,findings,breaking,changelog,checklist}=lastReview;
  try {
    const packet = exportPacket();
    downloadText(JSON.stringify(packet,null,2),'schemadiff-release-review.json','application/json;charset=utf-8');
    $('save-feedback').textContent = 'Review file downloaded. Original OpenAPI specs are not included.';
  } catch(error) { $('save-feedback').textContent = error.message; }
}});
updateLengths();

function markReviewEdited() {
  if (!lastReview) return;
  changedSinceSave = true;
  $('save-feedback').textContent = 'Unsaved review changes · Save locally or export a file.';
}

function exportPacket() {
  return createPacket({
    report: lastReview, title: $('review-title').value.trim(),
    reviewer: $('review-reviewer').value.trim(),
    completed, triage, id: currentReviewId || undefined
  });
}
function openPacket(packet,{fromLibrary=false}={}) {
  // Importing a review never automatically saves or overwrites browser data.
  analysisId++;
  beforeEditor.value='';
  afterEditor.value='';
  updateLengths();
  $('compare').disabled=false;
  $('compare').textContent='Analyze release impact ↗';
  const {triage:recorded,checklist, ...report}=packet;
  renderReview({...report,checklist:checklist.map(({id,label})=>({id,label}))});
  for(const item of checklist) if(item.done) completed.add(item.id);
  for(const entry of recorded) triage.set(entry.fingerprint,{disposition:entry.disposition,note:entry.note});
  $('review-title').value=packet.title;
  $('review-reviewer').value=packet.reviewer;
  currentReviewId=fromLibrary?packet.id:null;
  changedSinceSave=!fromLibrary;
  renderFindings();renderChecklist();
  $('save-feedback').textContent=fromLibrary
    ? 'Opened saved review · No original API specs are stored. You can update and save decisions.'
    : 'Imported review · Unsaved locally. Save here or export an updated file.';
  setStatus('Review opened. Original OpenAPI specs were not included; compare again by providing specs.');
}
function renderSavedReviews() {
  const list=$('saved-list');
  list.replaceChildren();
  let saves=[];
  try {saves=listSaved(window.localStorage);}catch { empty(list,'Browser storage is blocked. Import or export review JSON files instead.'); }
  $('saved-count').textContent=saves.length?'('+saves.length+')':'';
  if(!saves.length && !list.childElementCount) empty(list,'No saved reviews in this browser yet.');
  for(const item of saves) {
    const row=make('div','saved-row');
    const copy=make('div','saved-description');
    copy.append(make('strong','',item.title));
    copy.append(make('small','',item.api+' · '+new Date(item.updatedAt).toLocaleString()+' · '+(item.breakingCount??'Unknown')+' potential breaking findings'));
    const actions=make('div','saved-row-actions');
    const open=make('button','','Open');
    open.type='button';
    open.addEventListener('click',()=>{
      if(lastReview && changedSinceSave && !window.confirm('Discard unsaved review changes and open the saved review?')) return;
      try{
        const packet=loadSaved(window.localStorage,item.id);
        openPacket(packet,{fromLibrary:true});
        $('saved-panel').hidden=true;
        $('open-library').setAttribute('aria-expanded','false');
      }catch(e){setStatus(e.message,true);}
    });
    const remove=make('button','delete-review','Delete');
    remove.type='button';
    remove.setAttribute('aria-label','Delete saved review '+item.title);
    remove.addEventListener('click',()=>{
      if(!window.confirm('Permanently delete this browser snapshot? Export a file first if you need a backup.'))return;
      try{
        deleteSaved(window.localStorage,item.id);
        if(currentReviewId===item.id){currentReviewId=null;markReviewEdited();}
        renderSavedReviews();
      }catch(e){setStatus(e.message,true);}
    });
    actions.append(open,remove); row.append(copy,actions);list.append(row);
  }
}
$('review-title').addEventListener('input',markReviewEdited);
$('review-reviewer').addEventListener('input',markReviewEdited);
$('save-local').addEventListener('click',()=>{
  try{
    const packet=savePacket(window.localStorage,exportPacket());
    currentReviewId=packet.id;
    changedSinceSave=false;
    $('save-feedback').textContent='Saved on this browser at '+new Date(packet.updatedAt).toLocaleTimeString()+'. Export a file to back up or share.';
    renderSavedReviews();
  }catch(e){$('save-feedback').textContent=e.message||'Could not save review.';}
});
$('open-library').addEventListener('click',()=>{
  const show=$('saved-panel').hidden;
  $('saved-panel').hidden=!show;
  $('open-library').setAttribute('aria-expanded',String(show));
  if(show)renderSavedReviews();
});
$('import-review').addEventListener('change',async event=>{
  const input=event.target;
  const file=input.files?.[0];
  if(!file)return;
  try{
    if(file.size>1_400_000)throw new Error('Review file is too large (maximum 1.4 MB).');
    const packet=parsePacket(await file.text());
    if(lastReview && changedSinceSave && !window.confirm('Discard unsaved review changes and import this file?'))return;
    openPacket(packet);
    $('saved-panel').hidden=true;
    $('open-library').setAttribute('aria-expanded','false');
  } catch(error) {
    setStatus(error.message||'Could not open this review file.',true);
  } finally {input.value='';}
});
renderSavedReviews();
