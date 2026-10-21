import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCloud } from '../lib/compare-cloud.js';

const original = JSON.stringify({
  openapi: '3.0.3', info: { title: 'Fixture', version: '1.0.0' },
  paths: { '/items': { get: { responses: { '200': { description: 'OK' } } } } }
});
const revised = JSON.stringify({
  openapi: '3.0.3', info: { title: 'Fixture', version: '1.0.0' },
  paths: {}
});

test('real oasdiff engine processes removed API endpoint end to end', {timeout: 15000}, async () => {
  const report = await compareCloud({ base: original, revision: revised });
  assert.equal(typeof report.breaking, 'string');
  assert.equal(typeof report.changelog, 'string');
  assert.ok(report.breaking.length > 0, 'Removed endpoint should yield a breaking-change report');
  assert.match(report.breaking + report.changelog, /items/i);
});
