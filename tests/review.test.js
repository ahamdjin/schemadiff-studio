import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEndpoints, summarizeFindings, releaseChecklist } from '../lib/review.js';

function spec(paths, version = '1.0.0') {
  return {openapi:'3.0.3',info:{title:'Test API',version},paths};
}
const get = {get:{summary:'Read',responses:{'200':{description:'OK'}}}};
test('counts new, removed, edited and unchanged operations', () => {
  const baseline = spec({
    '/old': get,
    '/same': get,
    '/edited': {post:{summary:'V1',responses:{'201':{description:'Created'}}}}
  });
  const revision = spec({
    '/same': get,
    '/edited': {post:{summary:'V2',responses:{'201':{description:'Created'}}}},
    '/new': get
  },'2.0.0');
  const result=summarizeEndpoints(baseline,revision);
  assert.deepEqual(result.counts,{added:1,removed:1,edited:1,unchanged:1});
  assert.equal(result.base.operations,3);
  assert.equal(result.revision.version,'2.0.0');
  assert.equal(result.endpoints.find(x=>x.path==='/old').status,'removed');
});
test('key order does not produce false endpoint edits', () => {
  const base=spec({'/ping':{get:{summary:'Ping',tags:['status'],responses:{'200':{description:'OK'}}}}});
  const next=spec({'/ping':{get:{responses:{'200':{description:'OK'}},tags:['status'],summary:'Ping'}}});
  assert.equal(summarizeEndpoints(base,next).counts.unchanged,1);
});
test('breaking findings are counted independently from endpoint edits', () => {
  const a={changes:[{id:'api-removed',text:'GET /old removed',level:3,operation:'GET',path:'/old',fingerprint:'abc'}]};
  const b={changes:[...a.changes,{id:'api-added',text:'GET /new added',level:1,operation:'GET',path:'/new',fingerprint:'def'}]};
  const f=summarizeFindings(a,b);
  assert.equal(f.available,true);
  assert.equal(f.breakingCount,1);
  assert.equal(f.totalCount,2);
  assert.equal(f.findings.length,2);
  assert.equal(f.findings[0].severity,'error');
  assert.equal(f.findings[0].breaking,true);
});
test('missing structured findings are not misrepresented as zero risk', () => {
  const f=summarizeFindings({stdout:'one breaking change'},{stdout:'one change'});
  assert.equal(f.available,false);
  assert.equal(f.breakingCount,null);
  const review=releaseChecklist({counts:{removed:1,edited:0,added:0,unchanged:0}},f);
  assert.ok(review.some(i=>i.id==='verify'));
  assert.ok(review.some(i=>i.id==='removed'));
});
test('operation count is bounded for predictable response sizes', () => {
  const paths={};
  for(let i=0;i<1201;i++)paths['/route-'+i]=get;
  assert.throws(()=>summarizeEndpoints(spec(paths),spec({})),/too many operations/);
});
