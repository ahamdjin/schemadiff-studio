import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);
export const MAX_SPEC_LENGTH = 400 * 1024;

export function validateInput(data) {
  if (!data || typeof data !== 'object') throw new Error('Expected an object with base and revision specifications.');
  const { base, revision } = data;
  if (typeof base !== 'string' || typeof revision !== 'string') throw new Error('Both specifications must be text.');
  if (!base.trim() || !revision.trim()) throw new Error('Paste both the original and revised OpenAPI specifications.');
  if (Buffer.byteLength(base, 'utf8') > MAX_SPEC_LENGTH || Buffer.byteLength(revision, 'utf8') > MAX_SPEC_LENGTH) throw new Error('Each specification must be smaller than 400 KiB.');
  for (const spec of [base, revision]) {
    if (!/(^\s*\{|^\s*openapi\s*:|^\s*["']?swagger["']?\s*:)/m.test(spec.slice(0, 200))) throw new Error('Expected OpenAPI JSON or YAML starting with openapi/swagger.');
  }
  return { base, revision };
}

export async function compareSpecs(input, options = {}) {
  const { base, revision } = validateInput(input);
  const workingDirectory = await mkdtemp(join(tmpdir(), 'schemadiff-'));
  const binary = options.binary || process.env.OASDIFF_BIN || 'oasdiff';
  const run = options.run || exec;
  try {
    const basePath = join(workingDirectory, 'base.yaml');
    const revPath = join(workingDirectory, 'revision.yaml');
    await Promise.all([writeFile(basePath, base, { mode: 0o600 }), writeFile(revPath, revision, { mode: 0o600 })]);
    const args = mode => [mode, '--format', 'markdown', '--allow-external-refs=false', basePath, revPath];
    async function report(mode) {
      try {
        const result = await run(binary, args(mode), { cwd: workingDirectory, timeout: 12000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
        return result.stdout || '';
      } catch (error) {
        if (error.code === 'ENOENT') throw new Error('oasdiff CLI not installed. Install it and try again.');
        if (error.killed || error.code === 'ETIMEDOUT') throw new Error('Analysis exceeded the 12-second safety limit.');
        throw new Error('oasdiff could not analyze the supplied specifications. Check syntax, references, and OpenAPI validity.');
      }
    }
    const breaking = await report('breaking');
    const changelog = await report('changelog');
    return { breaking: breaking.trim(), changelog: changelog.trim() };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
