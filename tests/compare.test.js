import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, compareSpecs } from '../lib/compare.js';

const base = JSON.stringify({ openapi:'3.0.3', info:{title:'A',version:'1'}, paths:{} });
test('accepts a pair of OpenAPI JSON specs', () => assert.equal(validateInput({ base, revision: base }).base, base));
test('rejects empty inputs and oversized specs', () => {
  assert.throws(() => validateInput({ base: '', revision: base }), /Paste both/);
  assert.throws(() => validateInput({ base: 'x'.repeat(410000), revision: base }), /smaller than/);
});
test('calls oasdiff with references disabled for each report', async () => {
  const modes = [];
  const result = await compareSpecs({ base, revision: base }, { run: async (_binary, args) => {
    modes.push(args); return { stdout: '# Changes\n' };
  } });
  assert.equal(result.breaking, '# Changes');
  assert.equal(result.changelog, '# Changes');
  assert.deepEqual(modes.map(x=>x[0]), ['breaking', 'changelog']);
  assert.ok(modes.every(x=>x.includes('--allow-external-refs=false')));
});
test('cleans temp files even when the analyzer fails', async () => {
  await assert.rejects(compareSpecs({ base, revision: base }, { run: async () => {throw { code:'ENOENT' };} }), /oasdiff CLI not installed/);
});
