const base = document.querySelector('#base');
const revision = document.querySelector('#revision');
const breaking = document.querySelector('#breaking');
const changelog = document.querySelector('#changelog');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
let lastReport = null;
document.querySelector('#sample').addEventListener('click', () => {
  const spec = { openapi: '3.0.3', info: { title: 'Example API', version: '1.0.0' }, paths: { '/users': { get: { operationId: 'listUsers', responses: { 200: { description: 'OK' } } } } } };
  base.value = JSON.stringify(spec, null, 2);
  delete spec.paths['/users'];
  spec.paths['/accounts'] = { get: { operationId: 'listAccounts', responses: { 200: { description: 'OK' } } } };
  revision.value = JSON.stringify(spec, null, 2);
  status.textContent = 'Example loaded. Select Analyze changes.';
});
document.querySelector('#compare').addEventListener('click', async () => {
  const button = document.querySelector('#compare');
  button.disabled = true; button.textContent = 'Analyzing…';
  status.textContent = 'Analyzing contracts with oasdiff…'; lastReport = null; download.disabled = true;
  try {
    const response = await fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: base.value, revision: revision.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to analyze');
    breaking.textContent = data.breaking || 'No potentially breaking changes detected.';
    changelog.textContent = data.changelog || 'No changes detected.';
    lastReport = '# SchemaDiff Studio review\n\n## Potentially breaking changes\n\n' + breaking.textContent + '\n\n## Full changelog\n\n' + changelog.textContent + '\n';
    status.textContent = 'Analysis finished. Review findings before releasing changes.';
    download.disabled = false;
  } catch (error) { status.textContent = error.message || 'Comparison failed'; breaking.textContent = 'Unable to analyze.'; changelog.textContent = 'Unable to analyze.'; }
  finally { button.disabled = false; button.textContent = 'Analyze changes →'; }
});
download.addEventListener('click', () => {
  if (!lastReport) return;
  const url = URL.createObjectURL(new Blob([lastReport], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'api-change-review.md'; a.click(); URL.revokeObjectURL(url);
});
