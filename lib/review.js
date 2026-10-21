const METHODS = new Set(['get','post','put','patch','delete','head','options','trace']);
const LIMIT = 1200;

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function operations(spec) {
  const entries = new Map();
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    if (!path.startsWith('/') || !pathItem || typeof pathItem !== 'object') continue;
    for (const [method, op] of Object.entries(pathItem)) {
      if (!METHODS.has(method.toLowerCase()) || !op || typeof op !== 'object') continue;
      const key = method.toUpperCase() + ' ' + path;
      entries.set(key, { key, method: method.toUpperCase(), path,
        summary: String(op.summary || op.operationId || '').slice(0,180),
        tags: Array.isArray(op.tags) ? op.tags.filter(t => typeof t === 'string').slice(0,4) : [],
        signature: stable({ op, pathParameters: pathItem.parameters || [] }),
      });
      if (entries.size > LIMIT) throw new Error('Contract has too many operations to preview (limit 1,200).');
    }
  }
  return entries;
}

export function summarizeEndpoints(base, revision) {
  const oldOps = operations(base);
  const newOps = operations(revision);
  const endpoints = [];
  const counts = { added: 0, removed: 0, edited: 0, unchanged: 0 };
  for (const key of new Set([...oldOps.keys(), ...newOps.keys()])) {
    const prev = oldOps.get(key), next = newOps.get(key);
    const status = !prev ? 'added' : !next ? 'removed' : prev.signature !== next.signature ? 'edited' : 'unchanged';
    counts[status]++;
    const { signature, ...entry } = next || prev;
    endpoints.push({ ...entry, status });
  }
  const order = { removed: 0, edited: 1, added: 2, unchanged: 3 };
  endpoints.sort((a,b) => order[a.status] - order[b.status] || a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return {
    base: { title: String(base.info?.title || 'Baseline API').slice(0,140), version: String(base.info?.version || 'Unversioned').slice(0,80), operations: oldOps.size },
    revision: { title: String(revision.info?.title || 'Revision API').slice(0,140), version: String(revision.info?.version || 'Unversioned').slice(0,80), operations: newOps.size },
    counts, endpoints,
  };
}

function normalizeChange(change, breaking) {
  if (!change || typeof change !== 'object') return null;
  const level = Number(change.level);
  return {
    id: String(change.id || 'api-change').slice(0,130),
    message: String(change.text || change.comment || '').slice(0,1200),
    severity: level >= 3 ? 'error' : level === 2 ? 'warning' : 'info',
    breaking,
    method: String(change.operation || '').toUpperCase().slice(0,12),
    path: String(change.path || '').slice(0,350),
    fingerprint: String(change.fingerprint || '').slice(0,100)
  };
}

export function summarizeFindings(breakingResult, changelogResult) {
  const breakingAvailable = Array.isArray(breakingResult.changes);
  const changelogAvailable = Array.isArray(changelogResult.changes);
  const all = [];
  const seen = new Set();
  for (const [result, isBreaking] of [[breakingResult, true], [changelogResult, false]]) {
    for (const change of (Array.isArray(result.changes) ? result.changes : [])) {
      const entry = normalizeChange(change, isBreaking);
      if (!entry) continue;
      const key = entry.fingerprint || [entry.id,entry.message,entry.path,entry.method].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(entry);
      if (all.length >= 1500) break;
    }
  }
  return {
    available: breakingAvailable && changelogAvailable,
    breakingCount: breakingAvailable ? breakingResult.changes.length : null,
    totalCount: changelogAvailable ? changelogResult.changes.length : null,
    findings: all
  };
}

export function releaseChecklist(overview, findings) {
  const tasks = [
    { id:'coverage', label:'Verify the changed contract matches the API version you intend to release.' },
    { id:'consumers', label:'Identify dependent clients and communicate any compatibility risks.' },
    { id:'tests', label:'Run contract tests and representative integration tests against the implementation.' },
    { id:'docs', label:'Update examples, SDKs, documentation, and release notes if applicable.' }
  ];
  if (overview.counts.removed) tasks.unshift({ id:'removed', label:'Review removed endpoints and provide a migration or deprecation plan.' });
  if (overview.counts.edited) tasks.unshift({ id:'edited', label:'Review edited endpoint definitions for request and response compatibility.' });
  if (findings.breakingCount > 0) tasks.unshift({ id:'breaking', label:'Resolve, approve, or explicitly document every breaking-change finding.' });
  if (!findings.available) tasks.unshift({ id:'verify', label:'Review the raw oasdiff reports: structured finding counts were unavailable.' });
  return tasks;
}