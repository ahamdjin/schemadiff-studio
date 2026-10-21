import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCloud } from '../lib/compare-cloud.js';

const base = JSON.stringify({openapi:'3.0.3',info:{title:'A',version:'1'},paths:{'/old':{get:{responses:{200:{description:'OK'}}}}}});
const revision = JSON.stringify({openapi:'3.0.3',info:{title:'A',version:'1'},paths:{'/new':{get:{responses:{200:{description:'OK'}}}}}});

test('cloud interface produces both upstream reports from parsed OpenAPI objects', async () => {
  let calls = 0;
  const fake = async (a,b,opts) => {
    calls++;
    assert.equal(a.openapi, '3.0.3');
    assert.ok(b.paths['/new']);
    assert.equal(opts.format, 'markdown');
    assert.equal(opts.allowExternalRefs, false);
    return {exitCode:0,stdout:'## changed'};
  };
  const result = await compareCloud({base,revision},{breaking:fake,changelog:fake});
  assert.equal(calls,2);
  assert.equal(result.breaking,'## changed');
});
test('blocks any remote, absolute, or relative file references', async () => {
  for (const ref of ['https://internal.example/a.yaml','file:///etc/passwd','../secrets.yaml']) {
    const attack=JSON.stringify({openapi:'3.0.3',info:{title:'A',version:'1'},paths:{},components:{schemas:{Injected:{$ref:ref}}}});
    await assert.rejects(compareCloud({base:attack,revision}), /Only local/);
  }
});
test('supports YAML and rejects invalid document syntax', async () => {
  const yaml='openapi: 3.0.3\ninfo:\n  title: Demo\n  version: "1"\npaths: {}\n';
  const fake=async()=>({exitCode:0,stdout:'none'});
  assert.equal((await compareCloud({base:yaml,revision:yaml},{breaking:fake,changelog:fake})).changelog,'none');
  await assert.rejects(compareCloud({base:'openapi: [',revision:yaml}), /could not be parsed/);
});
