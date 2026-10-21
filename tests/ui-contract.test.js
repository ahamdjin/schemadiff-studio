import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('every JS DOM lookup has a matching element in the page', () => {
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const page=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const ids=[...app.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
  for(const id of ids)assert.ok(page.includes('id="'+id+'"'), 'Missing DOM element '+id);
  assert.ok(ids.length>25);
});
test('every analysis tab has an accessible tab panel',()=>{
  const page=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  for(const pane of ['endpoints','findings','checklist','reports']) {
    assert.ok(page.includes('id="tab-'+pane+'"'));
    assert.ok(page.includes('id="pane-'+pane+'"'));
  }
});
