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
    const match = section.match(/^## (#.+)$/m);
    if (match) {
      const title = match[1];
      const body = section.replace(/^## .+$/m, '').trim();
      items.push({ title, body, type: 'fragment' });
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
    if (match && !match[1].startsWith('#') && match[1].trim() !== '') {
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
  const { type, index, title, content } = body;
  const newSection = `## ${title}\n\n${content}`;

  if (type === 'thought') {
    const filePath = path.join(TREE, body.filename);
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

  // Find the section with matching ## title
  let sectionIdx = -1;
  let count = 0;
  for (let i = 0; i < sections.length; i++) {
    const m = sections[i].match(/^## .+$/m);
    if (m) {
      if (count === index) { sectionIdx = i; break; }
      count++;
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

  // Serve viewer HTML
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(VIEWER_HTML);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Already running — exit silently (fired by inject-context.js auto-start)
    process.exit(0);
  }
  console.error('Server error:', err.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`thinking-tree viewer: http://localhost:${PORT}`);
  console.log(`Watching: ${TREE}`);
});

// --- Embedded Viewer HTML ---

const VIEWER_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>thinking-tree</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --primary: #7c3aed;
  --primary-light: #a855f7;
  --primary-bg: #f5f3ff;
  --blue: #3b82f6;
  --green: #22c55e;
  --red: #e53935;
  --bg: #f9fafb;
  --white: #ffffff;
  --surface: #ffffff;
  --border: #e5e7eb;
  --border-light: #f3f4f6;
  --text: #111827;
  --text-secondary: #4b5563;
  --text-dim: #9ca3af;
  --radius: 8px;
  --radius-lg: 12px;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg); color: var(--text); height: 100vh;
  display: flex; flex-direction: column;
}
header {
  padding: 14px 24px; background: var(--white);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 12px;
  box-shadow: var(--shadow);
}
header h1 {
  font-size: 17px; font-weight: 700;
  background: linear-gradient(135deg, var(--blue) 0%, var(--primary) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
header .stats { font-size: 12px; color: var(--text-dim); margin-left: auto; }
.live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--green); display: inline-block;
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

main { flex: 1; display: flex; overflow: hidden; }

/* Left panel */
.panel-list {
  width: 280px; display: flex; flex-direction: column;
  background: var(--white); border-right: 1px solid var(--border);
}
.tabs {
  display: flex; background: var(--white);
  border-bottom: 1px solid var(--border); padding: 0 4px;
}
.tab {
  padding: 10px 12px; font-size: 13px; font-weight: 500;
  cursor: pointer; border-bottom: 2px solid transparent;
  color: var(--text-dim); transition: all 0.15s;
  white-space: nowrap;
}
.tab:hover { color: var(--text-secondary); }
.tab.active { color: var(--primary); border-bottom-color: var(--primary); }
.tab .count {
  background: var(--border-light); color: var(--text-secondary);
  padding: 1px 6px; border-radius: 10px;
  font-size: 11px; margin-left: 4px; font-weight: 400;
}
.tab.active .count { background: var(--primary-bg); color: var(--primary); }

.list { flex: 1; overflow-y: auto; }
.list::-webkit-scrollbar { width: 5px; }
.list::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
.list::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

.item {
  padding: 12px 16px; border-bottom: 1px solid var(--border-light);
  cursor: pointer; font-size: 13px; line-height: 1.5;
  transition: background 0.1s;
}
.item:hover { background: var(--bg); }
.item.active {
  background: var(--primary-bg);
  border-left: 3px solid var(--primary);
  padding-left: 13px;
}
.item.done { opacity: 0.45; }
.item .tag {
  color: var(--primary); font-size: 11px;
  font-weight: 500; letter-spacing: 0.3px;
}
.item .title { display: block; margin-top: 3px; color: var(--text); }
.item.active .title { color: var(--primary); font-weight: 500; }

/* Right panel */
.panel-preview {
  flex: 1; display: flex; flex-direction: column;
  min-width: 0; background: var(--white);
}
.preview-header {
  padding: 12px 24px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px;
  min-height: 48px;
}
.btn {
  padding: 6px 14px; border-radius: var(--radius);
  font-size: 12px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border); background: var(--white);
  color: var(--text-secondary); transition: all 0.15s;
}
.btn:hover { background: var(--bg); border-color: var(--text-dim); }
.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  color: white; border: none;
  box-shadow: 0 2px 6px rgba(124, 58, 237, 0.25);
}
.btn-primary:hover { box-shadow: 0 4px 10px rgba(124, 58, 237, 0.35); transform: translateY(-1px); }
.btn-cancel { color: var(--text-dim); }
.preview-actions { margin-left: auto; display: flex; gap: 6px; }

.preview-content {
  flex: 1; padding: 28px 36px; overflow-y: auto;
}
.preview-content::-webkit-scrollbar { width: 5px; }
.preview-content::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

/* Markdown styles */
.preview-content h1, .preview-content h2, .preview-content h3 { margin: 20px 0 10px; }
.preview-content h1 { font-size: 22px; font-weight: 700; color: var(--text); }
.preview-content h2 { font-size: 17px; font-weight: 600; color: var(--text); }
.preview-content h3 { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
.preview-content p { margin: 10px 0; line-height: 1.8; color: var(--text-secondary); }
.preview-content strong { color: var(--text); font-weight: 600; }
.preview-content code {
  background: var(--bg); padding: 2px 7px;
  border-radius: 4px; font-size: 13px; color: var(--primary);
}
.preview-content pre {
  background: #1e1e2e; color: #cdd6f4;
  padding: 16px 20px; border-radius: var(--radius-lg);
  overflow-x: auto; margin: 14px 0; font-size: 13px; line-height: 1.6;
}
.preview-content pre code { background: none; color: inherit; padding: 0; }
.preview-content ul, .preview-content ol { padding-left: 24px; margin: 10px 0; }
.preview-content li { margin: 5px 0; line-height: 1.7; color: var(--text-secondary); }
.preview-content table { border-collapse: collapse; margin: 14px 0; width: 100%; }
.preview-content th, .preview-content td {
  padding: 8px 14px; border: 1px solid var(--border);
  font-size: 13px; line-height: 1.5;
}
.preview-content th { background: var(--bg); font-weight: 600; text-align: left; }
.preview-content blockquote {
  border-left: 3px solid var(--primary);
  padding: 8px 16px; margin: 14px 0;
  background: var(--primary-bg); border-radius: 0 var(--radius) var(--radius) 0;
  color: var(--text-secondary);
}
.preview-content a { color: var(--primary); text-decoration: none; }
.preview-content a:hover { text-decoration: underline; }
.preview-content hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
.preview-content img { max-width: 100%; border-radius: var(--radius); }

/* Editor */
.editor {
  flex: 1; display: flex; flex-direction: column;
}
.editor textarea {
  flex: 1; padding: 24px 36px; border: none; outline: none;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 14px; line-height: 1.7; color: var(--text);
  background: var(--white); resize: none;
}

.empty {
  display: flex; align-items: center; justify-content: center;
  height: 100%; color: var(--text-dim); font-size: 14px;
}

/* Toast */
.toast {
  position: fixed; bottom: 24px; right: 24px;
  padding: 10px 20px; border-radius: var(--radius);
  background: var(--text); color: white; font-size: 13px;
  box-shadow: var(--shadow-md);
  animation: fadeUp 0.2s ease;
  z-index: 100;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
</head>
<body>
<header>
  <span class="live-dot" id="liveDot"></span>
  <h1>thinking-tree</h1>
  <span class="stats" id="stats"></span>
</header>
<main>
  <div class="panel-list">
    <div class="tabs">
      <div class="tab active" data-tab="fragments">碎片<span class="count" id="countFragments">0</span></div>
      <div class="tab" data-tab="questions">问题<span class="count" id="countQuestions">0</span></div>
      <div class="tab" data-tab="thoughts">思路<span class="count" id="countThoughts">0</span></div>
      <div class="tab" data-tab="todos">行动<span class="count" id="countTodos">0</span></div>
    </div>
    <div class="list" id="list"></div>
  </div>
  <div class="panel-preview">
    <div class="preview-header" id="previewHeader">
      <span id="previewTitle" style="font-weight:600;font-size:14px;color:var(--text-dim)"></span>
      <div class="preview-actions" id="previewActions"></div>
    </div>
    <div class="preview-content" id="preview">
      <div class="empty">选择左侧条目查看内容</div>
    </div>
  </div>
</main>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
<script>
let data = { fragments: [], questions: [], todos: [], thoughts: [] };
let currentTab = 'fragments';
let selectedIndex = -1;
let editing = false;

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (editing && !confirm('放弃未保存的编辑？')) return;
    editing = false;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    selectedIndex = -1;
    renderList();
    renderPreview();
  });
});

function getItems() {
  return data[currentTab] || [];
}

function renderList() {
  const items = getItems();
  const list = document.getElementById('list');
  list.innerHTML = items.map((item, i) => {
    const tagMatch = item.title.match(/^(#\\S+(?:\\s+#\\S+)*)\\s+(.+)$/);
    const tag = tagMatch ? tagMatch[1] : '';
    const title = tagMatch ? tagMatch[2] : item.title;
    const doneClass = item.done ? ' done' : '';
    const activeClass = i === selectedIndex ? ' active' : '';
    return \`<div class="item\${doneClass}\${activeClass}" data-index="\${i}">
      \${tag ? \`<span class="tag">\${tag}</span>\` : ''}
      <span class="title">\${title}</span>
    </div>\`;
  }).join('');

  list.querySelectorAll('.item').forEach(el => {
    el.addEventListener('click', () => {
      if (editing && !confirm('放弃未保存的编辑？')) return;
      editing = false;
      selectedIndex = parseInt(el.dataset.index);
      renderList();
      renderPreview();
    });
  });
}

function renderPreview() {
  const items = getItems();
  const preview = document.getElementById('preview');
  const actions = document.getElementById('previewActions');
  const titleEl = document.getElementById('previewTitle');

  if (selectedIndex < 0 || selectedIndex >= items.length) {
    preview.innerHTML = '<div class="empty">选择左侧条目查看内容</div>';
    actions.innerHTML = '';
    titleEl.textContent = '';
    return;
  }

  const item = items[selectedIndex];

  if (editing) {
    const raw = currentTab === 'thoughts'
      ? item.body
      : \`## \${item.title}\\n\\n\${item.body}\`;
    preview.innerHTML = \`<div class="editor"><textarea id="editorArea">\${escapeHtml(raw)}</textarea></div>\`;
    titleEl.textContent = '编辑中';
    actions.innerHTML = \`
      <button class="btn btn-cancel" onclick="cancelEdit()">取消</button>
      <button class="btn btn-primary" onclick="saveEdit()">保存</button>
    \`;
    return;
  }

  const fullMd = currentTab === 'thoughts'
    ? item.body
    : \`## \${item.title}\\n\\n\${item.body}\`;
  preview.innerHTML = \`<div class="preview-content">\${marked.parse(fullMd)}</div>\`;
  titleEl.textContent = item.title;
  actions.innerHTML = '<button class="btn" onclick="startEdit()">编辑</button>';
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function startEdit() {
  editing = true;
  renderPreview();
  const area = document.getElementById('editorArea');
  if (area) area.focus();
}

function cancelEdit() {
  editing = false;
  renderPreview();
}

async function saveEdit() {
  const area = document.getElementById('editorArea');
  if (!area) return;
  const raw = area.value;
  const items = getItems();
  const item = items[selectedIndex];

  let body;
  if (currentTab === 'thoughts') {
    body = { type: 'thought', filename: item.filename, content: raw };
  } else {
    const titleMatch = raw.match(/^## (.+)$/m);
    const title = titleMatch ? titleMatch[1] : item.title;
    const content = raw.replace(/^## .+\\n*/m, '').trim();
    const typeMap = { fragments: 'fragment', questions: 'question', todos: 'todo' };
    body = { type: typeMap[currentTab], index: selectedIndex, title, content };
  }

  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    if (result.ok) {
      editing = false;
      showToast('已保存');
      await fetchData();
      renderPreview();
    } else {
      showToast('保存失败: ' + (result.error || ''));
    }
  } catch (e) {
    showToast('保存失败: ' + e.message);
  }
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function updateStats() {
  document.getElementById('countFragments').textContent = data.fragments.length;
  document.getElementById('countQuestions').textContent = data.questions.filter(q => !q.done).length;
  document.getElementById('countThoughts').textContent = data.thoughts.length;
  document.getElementById('countTodos').textContent = data.todos.filter(t => !t.done).length;
  document.getElementById('stats').textContent =
    \`\${data.fragments.length} 碎片 · \${data.questions.filter(q=>!q.done).length} 问题 · \${data.thoughts.length} 思路\`;
}

async function fetchData() {
  try {
    const res = await fetch('/api/tree');
    data = await res.json();
    updateStats();
    renderList();
  } catch (e) {
    console.error('Fetch failed:', e);
  }
}

function connectSSE() {
  const es = new EventSource('/api/watch');
  es.addEventListener('update', e => {
    if (editing) return;
    data = JSON.parse(e.data);
    updateStats();
    renderList();
    if (selectedIndex >= 0) renderPreview();
  });
  es.onerror = () => {
    document.getElementById('liveDot').style.background = '#d1d5db';
    setTimeout(() => { es.close(); connectSSE(); }, 3000);
  };
  es.onopen = () => {
    document.getElementById('liveDot').style.background = '#22c55e';
  };
}

fetchData();
connectSSE();
<\/script>
</body>
</html>`;
