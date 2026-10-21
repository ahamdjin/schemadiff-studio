/**
 * Explicit, local-only release review snapshots. Never include original OpenAPI
 * documents. Review outputs can still contain sensitive paths or descriptions.
 */
export const REVIEW_KIND = 'schemadiff.release-review';
export const REVIEW_VERSION = 1;
export const MAX_PACKET_BYTES = 1_400_000;
const PREFIX = 'schemadiff:review:v1:';
const MAX_SAVED = 8;
const VALID_STATUS = new Set(['added','removed','edited','unchanged']);
const VALID_SEVERITY = new Set(['error','warning','info']);
const VALID_DISPOSITION = new Set(['open','fix','accepted','false-positive']);
const MAX_BREAKING = 300_000;

function string(value, label, limit) {
  if (typeof value !== 'string' || value.length > limit) throw new Error(label + ' is missing or too long.');
  return value;
}
function label(value, name, limit) {
  return string(value ?? '',name,limit).replace(/[\r\n\t]/g,' ').trim();
}
function unsigned(value,name,max=100000) {
  if(!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(name + ' must be a nonnegative integer.');
  return value;
}
function nullableCount(value,name) { return value === null ? null : unsigned(value,name); }
function limitedArray(value,name,max) {
  if(!Array.isArray(value) || value.length > max) throw new Error(name + ' is invalid or too large.');
  return value;
}
function versionMeta(value,name) {
  if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(name + ' is invalid.');
  return {
    title: label(value.title,name+' title',140),
    version: label(value.version,name+' version',80),
    operations: unsigned(value.operations,name+' operation count',1200)
  };
}
function normalizeOverview(value) {
  if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Overview is missing.');
  const counts = value.counts;
  if (!counts || typeof counts !== 'object') throw new Error('Endpoint counts are missing.');
  const tally = Object.fromEntries(['added','removed','edited','unchanged'].map(s => [s,unsigned(counts[s],s+' count',1200)]));
  const endpoints = limitedArray(value.endpoints,'Endpoints',2400).map(item => {
    if(!item || typeof item !== 'object' || !VALID_STATUS.has(item.status)) throw new Error('Invalid endpoint entry.');
    const method=label(item.method,'Endpoint method',12);
    const path=string(item.path,'Endpoint path',500);
    if(!/^(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS|TRACE)$/.test(method) || !path.startsWith('/')) throw new Error('Invalid endpoint method or path.');
    return {method,path,status:item.status,summary:label(item.summary,'Endpoint summary',180),tags:limitedArray(item.tags,'Tags',4).map(t=>label(t,'Tag',100)),key:label(item.key || method+' '+path,'Endpoint key',520)};
  });
  const sum=Object.values(tally).reduce((a,b)=>a+b,0);
  if(sum !== endpoints.length) throw new Error('Endpoint count does not match the inventory.');
  return {base:versionMeta(value.base,'Baseline'),revision:versionMeta(value.revision,'Revision'),counts:tally,endpoints};
}
function normalizeFindings(value) {
  if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Findings are missing.');
  if(typeof value.available !== 'boolean') throw new Error('Findings availability is invalid.');
  const items=limitedArray(value.findings,'Finding entries',1500).map(f=>{
    if(!f || typeof f !== 'object' || !VALID_SEVERITY.has(f.severity) || typeof f.breaking !== 'boolean') throw new Error('Invalid finding entry.');
    return {id:label(f.id,'Finding ID',130),message:string(f.message,'Finding description',1200),severity:f.severity,breaking:f.breaking,method:label(f.method,'Finding method',12),path:label(f.path,'Finding path',350),fingerprint:label(f.fingerprint,'Finding fingerprint',100)};
  });
  const breakingCount=nullableCount(value.breakingCount,'Breaking count');
  const totalCount=nullableCount(value.totalCount,'Total finding count');
  if(value.available && (breakingCount===null || totalCount===null)) throw new Error('Structured finding counts are missing.');
  if(!value.available && (breakingCount!==null || totalCount!==null)) throw new Error('Unstructured findings must not claim zero counts.');
  return {available:value.available,breakingCount,totalCount,findings:items};
}
function normalizeChecklist(value) {
  return limitedArray(value,'Checklist',40).map(item=>{
    if(!item || typeof item !== 'object') throw new Error('Invalid checklist item.');
    const id=label(item.id,'Checklist ID',80);
    if(!id) throw new Error('Checklist ID missing.');
    return {id,label:label(item.label,'Checklist description',320),done:item.done===true};
  });
}
function normalizeTriage(value,findings) {
  const allowed = new Set(findings.findings.map(f=>f.fingerprint || [f.id,f.method,f.path,f.message].join('|')));
  const seen=new Set();
  return limitedArray(value,'Triage decisions',1500).map(item=>{
    if(!item || typeof item !== 'object') throw new Error('Invalid triage entry.');
    const fingerprint=string(item.fingerprint,'Finding key',1800);
    if(!allowed.has(fingerprint) || seen.has(fingerprint)) throw new Error('Triage entry does not match this review.');
    seen.add(fingerprint);
    if(!VALID_DISPOSITION.has(item.disposition)) throw new Error('Invalid review decision.');
    return {fingerprint,disposition:item.disposition,note:string(item.note ?? '','Reviewer note',600)};
  });
}
export function validatePacket(packet) {
  if(!packet || typeof packet !== 'object' || Array.isArray(packet)) throw new Error('Review file must contain a JSON object.');
  if(packet.kind !== REVIEW_KIND || packet.schemaVersion !== REVIEW_VERSION) throw new Error('Unsupported review file. Export a version 1 review from SchemaDiff Studio.');
  const id=label(packet.id,'Review ID',100);
  if(!/^[a-zA-Z0-9-]{12,100}$/.test(id)) throw new Error('Invalid review identifier.');
  const title=label(packet.title,'Review name',120);
  if(!title) throw new Error('Review name is required.');
  const reviewer=label(packet.reviewer,'Reviewer',100);
  const updatedAt=string(packet.updatedAt,'Saved date',50);
  if(!Number.isFinite(Date.parse(updatedAt))) throw new Error('Review save date is invalid.');
  const overview=normalizeOverview(packet.overview);
  const findings=normalizeFindings(packet.findings);
  const checklist=normalizeChecklist(packet.checklist);
  const triage=normalizeTriage(packet.triage,findings);
  const breaking=string(packet.breaking,'Breaking report',MAX_BREAKING);
  const changelog=string(packet.changelog,'Changelog',MAX_BREAKING);
  return {kind:REVIEW_KIND,schemaVersion:REVIEW_VERSION,id,title,reviewer,updatedAt,overview,findings,checklist,triage,breaking,changelog};
}
export function createPacket({report,title,reviewer,completed,triage,id,now=new Date().toISOString()}) {
  if(!report) throw new Error('Run a comparison or open a review first.');
  const identifier = id || crypto.randomUUID();
  const entries = report.findings.findings.map(f=>{
    const fingerprint=f.fingerprint || [f.id,f.method,f.path,f.message].join('|');
    const decision=triage.get(fingerprint) || {disposition:'open',note:''};
    return {fingerprint,...decision};
  });
  return validatePacket({
    kind:REVIEW_KIND,schemaVersion:REVIEW_VERSION,id:identifier,
    title,reviewer,updatedAt:now,
    overview:report.overview,findings:report.findings,
    breaking:report.breaking,changelog:report.changelog,
    checklist:report.checklist.map(item=>({...item,done:completed.has(item.id)})),
    triage:entries
  });
}
export function parsePacket(text) {
  if(typeof text !== 'string' || new TextEncoder().encode(text).length>MAX_PACKET_BYTES) throw new Error('Review file exceeds the 1.4 MB safety limit.');
  let value;
  try { value=JSON.parse(text); } catch { throw new Error('Review file is not valid JSON.'); }
  return validatePacket(value);
}
function getKey(id) { return PREFIX + id; }
export function listSaved(storage) {
  const results=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(!key?.startsWith(PREFIX))continue;
    try{
      const packet=parsePacket(storage.getItem(key));
      results.push({id:packet.id,title:packet.title,reviewer:packet.reviewer,updatedAt:packet.updatedAt,
        api:packet.overview.base.title,breakingCount:packet.findings.breakingCount});
    }catch{ /* Corrupt or incompatible storage entries are never executed or displayed. */ }
  }
  return results.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,MAX_SAVED);
}
export function savePacket(storage,packet) {
  const safe=validatePacket(packet);
  const serialized=JSON.stringify(safe);
  if(new TextEncoder().encode(serialized).length>MAX_PACKET_BYTES) throw new Error('Review exceeds the 1.4 MB storage limit. Export a report instead.');
  const key=getKey(safe.id);
  if(storage.getItem(key)===null && listSaved(storage).length>=MAX_SAVED) throw new Error('Browser library limit reached (8 reviews). Delete an older review or export it before saving.');
  try {storage.setItem(key,serialized);} catch {throw new Error('Browser storage unavailable or full. Export a review file instead.');}
  return safe;
}
export function loadSaved(storage,id) {
  if(typeof id!=='string'||!/^[a-zA-Z0-9-]{12,100}$/.test(id)) throw new Error('Invalid saved review.');
  const text=storage.getItem(getKey(id));
  if(text===null) throw new Error('This review no longer exists in this browser.');
  return parsePacket(text);
}
export function deleteSaved(storage,id) {
  if(typeof id!=='string'||!/^[a-zA-Z0-9-]{12,100}$/.test(id)) throw new Error('Invalid saved review.');
  storage.removeItem(getKey(id));
}
