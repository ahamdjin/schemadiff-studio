import test from 'node:test';
import assert from 'node:assert/strict';
import {createPacket,parsePacket,savePacket,loadSaved,listSaved,deleteSaved,MAX_PACKET_BYTES} from '../public/review-store.js';

const endpoint = {key:'GET /items',method:'GET',path:'/items',summary:'List items',tags:[],status:'removed'};
const finding = {fingerprint:'abcdef',id:'api-path-removed',message:'Path removed',method:'GET',path:'/items',severity:'error',breaking:true};
const report = {
  overview: {base:{title:'Example API',version:'1',operations:1},revision:{title:'Example API',version:'2',operations:0},
    counts:{added:0,removed:1,edited:0,unchanged:0},endpoints:[endpoint]},
  findings:{available:true,breakingCount:1,totalCount:1,findings:[finding]},
  checklist:[{id:'breaking',label:'Review breaking changes'}],
  breaking:'GET /items was removed',changelog:'GET /items removed',
};
function packet() {
  return createPacket({report,title:'Release 2',reviewer:'QA team',completed:new Set(['breaking']),
    triage:new Map([['abcdef',{disposition:'fix',note:'Tracked in API-100'}]]),id:'12345678-1234-1234-1234-123456789abc',
    now:'2026-10-22T01:00:00.000Z'});
}
function memoryStore() {
  const entries=new Map();
  return {get length(){return entries.size;},key(i){return [...entries.keys()][i]||null;},getItem(k){return entries.get(k)||null;},
    setItem(k,v){entries.set(k,v);},removeItem(k){entries.delete(k);}};
}
test('round trip retains decisions, checklist and metadata but never raw specs',()=>{
  const p=packet();
  const parsed=parsePacket(JSON.stringify(p));
  assert.equal(parsed.title,'Release 2');
  assert.equal(parsed.triage[0].disposition,'fix');
  assert.equal(parsed.triage[0].note,'Tracked in API-100');
  assert.equal(parsed.checklist[0].done,true);
  assert.equal(JSON.stringify(parsed).includes('"openapi"'),false);
});
test('saved review can be reopened and updated without duplicate library entries',()=>{
  const storage=memoryStore();
  const original=savePacket(storage,packet());
  const reopened=loadSaved(storage,original.id);
  assert.equal(listSaved(storage).length,1);
  reopened.triage[0].note='Verified in staging';
  savePacket(storage,reopened);
  assert.equal(listSaved(storage).length,1);
  assert.equal(loadSaved(storage,original.id).triage[0].note,'Verified in staging');
  deleteSaved(storage,original.id);
  assert.equal(listSaved(storage).length,0);
});
test('rejects unsupported, malformed, and oversized review files',()=>{
  const p=packet();
  assert.throws(()=>parsePacket('{"kind":"unrelated"}'),/Unsupported/);
  assert.throws(()=>parsePacket('{bad'),/not valid JSON/);
  assert.throws(()=>parsePacket('x'.repeat(MAX_PACKET_BYTES+1)),/1.4 MB/);
  assert.throws(()=>parsePacket(JSON.stringify({...p,schemaVersion:5})),/Unsupported/);
});
test('rejects inconsistent counts and unrecognized review dispositions',()=>{
  const p=packet();
  assert.throws(()=>parsePacket(JSON.stringify({...p,overview:{...p.overview,counts:{...p.overview.counts,removed:0}}})),/count does not match/);
  assert.throws(()=>parsePacket(JSON.stringify({...p,triage:[{fingerprint:'abcdef',disposition:'execute',note:'oops'}]})),/Invalid review decision/);
  assert.throws(()=>parsePacket(JSON.stringify({...p,triage:[{fingerprint:'unknown',disposition:'fix',note:''}]})),/does not match/);
});
test('rejects a file pretending no breaking findings when structured counts are unavailable',()=>{
  const p=packet();
  assert.throws(()=>parsePacket(JSON.stringify({...p,findings:{...p.findings,available:false,breakingCount:0}})),/Unstructured findings/);
});
test('browser library refuses to overwrite when eight unique reviews are already stored',()=>{
  const s=memoryStore();
  for(let i=0;i<8;i++)savePacket(s,{...packet(),id:'12345678-1234-1234-1234-'+String(i).padStart(12,'0')});
  assert.equal(listSaved(s).length,8);
  assert.throws(()=>savePacket(s,{...packet(),id:'12345678-1234-1234-1234-999999999999'}),/limit reached/);
});
