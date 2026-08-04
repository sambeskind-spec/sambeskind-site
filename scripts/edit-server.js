// Local-only editor server for the bookshelf.
// Run: node scripts/edit-server.js  (or double-click edit-bookshelf.command)
// Serves a form UI, writes bookshelf-data.json, re-renders bookshelf.html,
// then commits + pushes so Vercel auto-deploys. No external dependencies.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { render, DATA_PATH } = require('./render');

const ROOT = path.join(__dirname, '..');
const PORT = 4321;
const EDITOR_HTML = path.join(__dirname, 'editor.html');

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 5e6) reject(new Error('payload too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function git(args) {
  return new Promise((resolve) => {
    exec('git ' + args, { cwd: ROOT, maxBuffer: 1e7 }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code || 1) : 0, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

async function deploy() {
  // stage only the files this tool owns, so unrelated working changes aren't swept in
  await git('add bookshelf-data.json bookshelf.html');

  const status = await git('status --porcelain bookshelf-data.json bookshelf.html');
  if (!status.stdout) {
    return { ok: true, message: 'saved · no changes to deploy' };
  }

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const commit = await git(`commit -m "Update bookshelf (${stamp})"`);
  if (commit.code !== 0) {
    return { ok: false, message: 'commit failed: ' + (commit.stderr || commit.stdout) };
  }

  const push = await git('push');
  if (push.code !== 0) {
    return { ok: false, message: 'saved + committed, but push failed: ' + (push.stderr || push.stdout) };
  }
  return { ok: true, message: 'deployed ✓ live in ~30s' };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = (req.url || '/').split('?')[0];

    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(EDITOR_HTML));
    }

    if (req.method === 'GET' && url === '/api/data') {
      return send(res, 200, 'application/json', fs.readFileSync(DATA_PATH));
    }

    if (req.method === 'POST' && url === '/api/save') {
      const raw = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch (e) { return send(res, 400, 'application/json', JSON.stringify({ ok: false, message: 'invalid JSON' })); }

      if (!parsed || !Array.isArray(parsed.categories)) {
        return send(res, 400, 'application/json', JSON.stringify({ ok: false, message: 'malformed data' }));
      }

      // 1) write source of truth  2) re-render static page
      fs.writeFileSync(DATA_PATH, JSON.stringify(parsed, null, 2) + '\n');
      render();

      // 3) commit + push -> Vercel auto-deploy
      const result = await deploy();
      return send(res, 200, 'application/json', JSON.stringify(result));
    }

    send(res, 404, 'text/plain', 'not found');
  } catch (e) {
    send(res, 500, 'application/json', JSON.stringify({ ok: false, message: e.message }));
  }
});

server.listen(PORT, () => {
  const addr = 'http://localhost:' + PORT;
  console.log('\n  Bookshelf editor running at ' + addr);
  console.log('  Edit your entries, hit "Save & deploy".');
  console.log('  Close this window (or Ctrl+C) when done.\n');
  exec('open ' + addr);
});
