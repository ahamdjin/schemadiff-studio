import YAML from 'yaml';
import { runOasdiffBreakingFromSpecs, runOasdiffChangelogFromSpecs } from '@oasdiff-js/oasdiff-js';
import { validateInput } from './compare.js';
import { summarizeEndpoints, summarizeFindings, releaseChecklist } from './review.js';

const MAX_DEPTH = 48;
const MAX_KEYS = 15000;

function parseDocument(input) {
  let doc;
  try {
    const parsed = YAML.parseDocument(input, { uniqueKeys: true, merge: false, maxAliasCount: 20 });
    if (parsed.errors.length) throw new Error('OpenAPI YAML or JSON could not be parsed.');
    doc = parsed.toJS({ maxAliasCount: 20 });
  } catch {
    throw new Error('OpenAPI YAML or JSON could not be parsed.');
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || (!doc.openapi && !doc.swagger)) {
    throw new Error('Expected an OpenAPI document with an openapi or swagger version field.');
  }
  let visited = 0;
  function guard(value, depth = 0) {
    if (depth > MAX_DEPTH || ++visited > MAX_KEYS) throw new Error('OpenAPI document is too deeply nested or complex.');
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      if (key === '$ref' && (typeof nested !== 'string' || !nested.startsWith('#/'))) {
        throw new Error('Only local #/ references are supported. External and file references are blocked.');
      }
      guard(nested, depth + 1);
    }
  }
  guard(doc);
  return doc;
}

export async function compareCloud(input, drivers = {}) {
  const { base, revision } = validateInput(input);
  const before = parseDocument(base);
  const after = parseDocument(revision);
  const breakingFn = drivers.breaking || runOasdiffBreakingFromSpecs;
  const changelogFn = drivers.changelog || runOasdiffChangelogFromSpecs;
  const opts = { format: 'markdown', allowExternalRefs: false };
  try {
    const [breaking, changelog] = await Promise.all([
      breakingFn(before, after, opts),
      changelogFn(before, after, opts),
    ]);
    if ([breaking, changelog].some(result => result.exitCode > 1)) {
      throw new Error('oasdiff returned an analysis error.');
    }
    const overview = summarizeEndpoints(before, after);
    const findings = summarizeFindings(breaking, changelog);
    return {
      breaking: (breaking.stdout || '').slice(0, 300000).trim(),
      changelog: (changelog.stdout || '').slice(0, 300000).trim(),
      overview, findings,
      checklist: releaseChecklist(overview, findings),
    };
  } catch {
    throw new Error('Could not compare these OpenAPI contracts. Check document validity and supported references.');
  }
}
