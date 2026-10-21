import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCloud } from '../lib/compare-cloud.js';
import { runOasdiffBreakingFromSpecs } from '@oasdiff-js/oasdiff-js';

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

test('real engine gives structured findings and a release checklist', {timeout: 15000}, async () => {
  const report = await compareCloud({base:original,revision:revised});
  assert.equal(report.overview.counts.removed,1);
  assert.equal(report.overview.base.operations,1);
  assert.equal(report.overview.revision.operations,0);
  assert.ok(Array.isArray(report.checklist));
  assert.ok(report.checklist.some(task=>task.id==='removed'));
  const direct = await runOasdiffBreakingFromSpecs(JSON.parse(original),JSON.parse(revised),{format:'json',allowExternalRefs:false});
  console.log('JSON_DIAGNOSTIC',JSON.stringify({changes:direct.changes,stdout:direct.stdout,exit:direct.exitCode}).slice(0,3300));
  console.log('INTEGRATION_DIAGNOSTIC',JSON.stringify({finding:report.findings,breaking:report.breaking,changelog:report.changelog}).slice(0,3500));
  assert.ok(report.findings.available,'The oasdiff wrapper should expose structured changes');
  assert.ok(report.findings.breakingCount>=1,'Removing GET /items should be reported as breaking');
  assert.ok(report.findings.findings.some(item=>item.path.includes('items') || item.message.includes('items')));
});
