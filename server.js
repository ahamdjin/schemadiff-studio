import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { compareSpecs } from './lib/compare.js';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public');
const assets = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'application/javascript; charset=utf-8']], ['/style.css', ['style.css', 'text/css; charset=utf-8']]]);
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'");
  if (req.method === 'GET' && assets.has(req.url)) {
    const [file, type] = assets.get(req.url);
    try { const data = await readFile(join(publicDir, file)); res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(data); }
    catch { res.writeHead(500); res.end('Unable to load application'); }
    return;
  }
  if (req.method !== 'POST' || req.url !== '/api/compare') { res.writeHead(404); res.end('Not found'); return; }
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') { res.writeHead(415); res.end('Expected JSON'); return; }
  let bytes = 0; const chunks = [];
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 900 * 1024) { const error = new Error('Request too large'); error.status = 413; throw error; }
      chunks.push(chunk);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const report = await compareSpecs(data);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(report));
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Invalid JSON request.' : error.message;
    const status = error.status || (message?.includes('oasdiff') || message?.includes('safety limit') ? 503 : 400);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: message || 'Unable to compare specifications.' }));
  }
});
const port = Number(process.env.PORT || 4170);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log('SchemaDiff Studio: http://' + host + ':' + port));
