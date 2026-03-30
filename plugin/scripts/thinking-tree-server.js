#!/usr/bin/env node
// thinking-tree web viewer — standalone read-only server
// Usage: node thinking-tree-server.js [port]
// Opens: http://localhost:3456

const http = require('http');
const fs = require('fs');
const path = require('path');

const TREE = path.join(process.env.USERPROFILE || process.env.HOME, '.thinking-tree');
const PORT = parseInt(process.argv[2]) || 3456;

// --- Data Parsing ---

function readFile(name) {
  try { return fs.readFileSync(path.join(TREE, name), 'utf-8'); } catch { return ''; }
}

function parseFragments() {
  const content = readFile('fragments.md');
  const sections = content.split(/\r?\n---\r?\n/);
  const items = [];
  for (const section of sections) {
    const match = section.match(/^## (.+)$/m);
    if (match) {
      const title = match[1];
      const body = section.replace(/^## .+$/m, '').trim();
      const idMatch = section.match(/<!-- frag:(\d+)/);
      const id = idMatch ? parseInt(idMatch[1]) : null;
      items.push({ title, body, type: 'fragment', id });
    }
  }
  return items;
}

function parseQuestions() {
  const content = readFile('questions.md');
  const sections = content.split(/\r?\n---\r?\n/);
  const items = [];
  for (const section of sections) {
    const match = section.match(/^## (.+)$/m);
    if (match && match[1].trim() !== '') {
      const title = match[1];
      const done = title.startsWith('✓');
      const body = section.replace(/^## .+$/m, '').trim();
      items.push({ title, body, done, type: 'question' });
    }
  }
  return items;
}

function parseTodos() {
  const content = readFile('todos.md');
  const sections = content.split(/\r?\n---\r?\n/);
  const items = [];
  for (const section of sections) {
    const match = section.match(/^## (.+)$/m);
    if (match && !match[1].includes('创建于') && !match[1].includes('更新于')) {
      const title = match[1];
      const done = title.startsWith('✅');
      const body = section.replace(/^## .+$/m, '').trim();
      items.push({ title, body, done, type: 'todo' });
    }
  }
  return items;
}

function listThoughtFiles() {
  try {
    const files = fs.readdirSync(TREE).filter(f =>
      f.endsWith('.md') &&
      !['fragments.md', 'questions.md', 'todos.md', '.session-log.md'].includes(f)
    );
    return files.map(f => ({
      title: f.replace('.md', ''),
      filename: f,
      body: readFile(f),
      type: 'thought'
    }));
  } catch { return []; }
}

function getAllData() {
  return {
    fragments: parseFragments(),
    questions: parseQuestions(),
    todos: parseTodos(),
    thoughts: listThoughtFiles(),
    updatedAt: new Date().toISOString()
  };
}

// --- Save API ---

function saveItem(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid request' };
  const { type, id, index, title, content } = body;
  if (type !== 'thought' && (!title || content == null)) return { ok: false, error: 'missing title or content' };
  const newSection = `## ${title}\n\n${content}`;

  if (type === 'thought') {
    // Prevent path traversal — only allow basename within TREE
    const safe = path.basename(body.filename || '');
    if (!safe || safe.startsWith('.')) return { ok: false, error: 'invalid filename' };
    const filePath = path.resolve(TREE, safe);
    if (!filePath.startsWith(path.resolve(TREE))) return { ok: false, error: 'invalid path' };
    fs.writeFileSync(filePath, content, 'utf-8');
    return { ok: true };
  }

  const fileMap = { fragment: 'fragments.md', question: 'questions.md', todo: 'todos.md' };
  const filename = fileMap[type];
  if (!filename) return { ok: false, error: 'unknown type' };

  const raw = readFile(filename);
  const parts = raw.split(/(\r?\n---\r?\n)/);

  // Rebuild: parts alternate between content and separator
  const sections = [];
  const separators = [];
  let current = '';
  for (const part of parts) {
    if (/^\r?\n---\r?\n$/.test(part)) {
      sections.push(current);
      separators.push(part);
      current = '';
    } else {
      current += part;
    }
  }
  sections.push(current);

  // Find the target section — by frag:ID if available, fallback to index
  let sectionIdx = -1;
  if (type === 'fragment' && id != null) {
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].includes(`<!-- frag:${id}`)) { sectionIdx = i; break; }
    }
  } else {
    let count = 0;
    for (let i = 0; i < sections.length; i++) {
      if (/^## .+$/m.test(sections[i])) {
        if (count === index) { sectionIdx = i; break; }
        count++;
      }
    }
  }

  if (sectionIdx < 0) return { ok: false, error: 'section not found' };
  sections[sectionIdx] = sections[sectionIdx].replace(
    /## .+[\s\S]*/m,
    newSection
  );

  // Reassemble
  let result = '';
  for (let i = 0; i < sections.length; i++) {
    result += sections[i];
    if (i < separators.length) result += separators[i];
  }
  fs.writeFileSync(path.join(TREE, filename), result, 'utf-8');
  return { ok: true };
}

// --- Delete API ---

function deleteItem(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid request' };
  const { type, id, index } = body;
  if (id == null && typeof index !== 'number') return { ok: false, error: 'missing id or index' };

  const fileMap = { fragment: 'fragments.md', question: 'questions.md', todo: 'todos.md' };
  const filename = fileMap[type];
  if (!filename) return { ok: false, error: 'unknown type' };

  const raw = readFile(filename);
  const parts = raw.split(/(\r?\n---\r?\n)/);

  const sections = [];
  const seps = [];
  let cur = '';
  for (const p of parts) {
    if (/^\r?\n---\r?\n$/.test(p)) { sections.push(cur); seps.push(p); cur = ''; }
    else cur += p;
  }
  sections.push(cur);

  // Find target section — by frag:ID if available, fallback to index
  let target = -1;
  if (type === 'fragment' && id != null) {
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].includes(`<!-- frag:${id}`)) { target = i; break; }
    }
  } else {
    const itemIndices = [];
    for (let i = 0; i < sections.length; i++) {
      if (/^## .+$/m.test(sections[i])) itemIndices.push(i);
    }
    if (index < 0 || index >= itemIndices.length) return { ok: false, error: 'index out of range' };
    target = itemIndices[index];
  }
  if (target < 0) return { ok: false, error: 'item not found' };

  if (target === 0) {
    // First section may contain file header — preserve content before <!-- frag: or ##
    const s = sections[0];
    const cutAt = s.search(/^(<!-- (frag|question|todo):\d+[^>]*-->[\r\n]*)?## /m);
    if (cutAt > 0) {
      sections[0] = s.slice(0, cutAt).replace(/\s+$/, '\n');
      if (seps.length > 0) seps.splice(0, 1);
    } else {
      sections.splice(0, 1);
      if (seps.length > 0) seps.splice(0, 1);
    }
  } else {
    sections.splice(target, 1);
    const sepIdx = target - 1;
    if (sepIdx >= 0 && sepIdx < seps.length) seps.splice(sepIdx, 1);
  }

  let result = '';
  for (let i = 0; i < sections.length; i++) {
    result += sections[i];
    if (i < seps.length) result += seps[i];
  }
  result = result.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(path.join(TREE, filename), result, 'utf-8');
  return { ok: true };
}

// --- SSE ---

const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

let watchDebounce = null;
try {
  fs.watch(TREE, { recursive: false }, (eventType, filename) => {
    if (filename && filename.endsWith('.md')) {
      clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => broadcast('update', getAllData()), 300);
    }
  });
} catch (e) {
  console.error('File watch not available:', e.message);
}

// --- HTTP Server ---

// Read viewer.html on each request (enables hot-reload after plugin update)
const VIEWER_PATH = path.join(__dirname, 'viewer.html');
const VIEWER_FALLBACK = '<!DOCTYPE html><html><body><h1>thinking-tree viewer</h1><p>viewer.html not found. Please reinstall the plugin.</p></body></html>';
function getViewerHtml() {
  try { return fs.readFileSync(VIEWER_PATH, 'utf-8'); } catch { return VIEWER_FALLBACK; }
}

const server = http.createServer((req, res) => {
  // API: get all data
  if (req.url === '/api/tree') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(getAllData()));
    return;
  }

  // API: save item
  if (req.url === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const result = saveItem(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: delete item
  if (req.url === '/api/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const result = deleteItem(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: /think status
  if (req.url === '/api/think-status') {
    const rulesDir = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'rules');
    const active = fs.existsSync(path.join(rulesDir, 'clarifier.md'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ active }));
    return;
  }

  // API: SSE
  if (req.url === '/api/watch') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Serve viewer HTML (re-read each time for hot-reload)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(getViewerHtml());
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Already running — exit silently (fired by inject-context.js auto-start)
    process.exit(0);
  }
  console.error('Server error:', err.message);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`thinking-tree viewer: http://localhost:${PORT}`);
  console.log(`Watching: ${TREE}`);
});
