#!/usr/bin/env node
// thinking-tree SessionStart hook
// 1. Clean stale plugin cache versions
// 2. Sync rules from plugin to ~/.claude/rules/
// 3. Inject recent fragments, questions, todos as context

const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || process.env.HOME;
const TREE = path.join(HOME, '.thinking-tree');
const RULES_DIR = path.join(HOME, '.claude', 'rules');
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');

// --- Clean stale cache versions ---
// Plugin system never cleans old version directories; we do it ourselves
function cleanStaleCache() {
  try {
    const currentVersion = JSON.parse(
      fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf-8')
    ).version;
    if (!currentVersion) return;

    const cacheParent = path.dirname(PLUGIN_ROOT); // .../cache/CoralLips/thinking-tree/
    const entries = fs.readdirSync(cacheParent);
    for (const entry of entries) {
      if (entry === currentVersion) continue;
      const full = path.join(cacheParent, entry);
      try {
        if (fs.statSync(full).isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        }
      } catch {}
    }
  } catch {}
}

try { cleanStaleCache(); } catch {}

// --- Rules sync ---
// Sync rules to ~/.claude/rules/ when ON, remove them when OFF (zero token cost)
function syncRules() {
  const pluginRules = path.join(PLUGIN_ROOT, 'rules');
  if (!fs.existsSync(pluginRules)) return;

  // Check .think-state to decide sync or remove
  const stateFile = path.join(TREE, '.think-state');
  let isOn = false;
  try { isOn = fs.readFileSync(stateFile, 'utf-8').trim() === 'on'; } catch {}

  fs.mkdirSync(RULES_DIR, { recursive: true });

  for (const file of fs.readdirSync(pluginRules)) {
    if (!file.endsWith('.md')) continue;
    const dest = path.join(RULES_DIR, file);

    if (isOn) {
      const src = path.join(pluginRules, file);
      const srcContent = fs.readFileSync(src, 'utf-8');
      let destContent = '';
      try { destContent = fs.readFileSync(dest, 'utf-8'); } catch {}
      if (srcContent !== destContent) {
        fs.writeFileSync(dest, srcContent, 'utf-8');
      }
    } else {
      try { fs.unlinkSync(dest); } catch {}
    }
    // Clean up legacy .off files
    try { fs.unlinkSync(dest + '.off'); } catch {}
  }
}

try {
  syncRules();
} catch (e) {
  console.error(`🌳 [thinking-tree] rules sync failed: ${e.message}`);
}

// --- First-run initialization ---
try {
  if (!fs.existsSync(TREE)) {
    fs.mkdirSync(TREE, { recursive: true });
    console.log('🌳 [thinking-tree] initialized ~/.thinking-tree/ — use /think to enable recording');
  }
  // Ensure .think-state exists (default off for new installs)
  const stateFile = path.join(TREE, '.think-state');
  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, 'off', 'utf-8');
  }
} catch (e) {
  console.error(`🌳 [thinking-tree] init failed: ${e.message}`);
}

// --- Deploy write-item.js to ~/.thinking-tree/bin/ ---
try {
  const binDir = path.join(TREE, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const src = path.join(PLUGIN_ROOT, 'scripts', 'write-item.js');
  const dest = path.join(binDir, 'write-item.js');
  if (fs.existsSync(src)) {
    const srcContent = fs.readFileSync(src, 'utf-8');
    let destContent = '';
    try { destContent = fs.readFileSync(dest, 'utf-8'); } catch {}
    if (srcContent !== destContent) fs.writeFileSync(dest, srcContent, 'utf-8');
  }
} catch { /* non-fatal */ }

function readFile(name) {
  try {
    return fs.readFileSync(path.join(TREE, name), 'utf-8');
  } catch {
    return '';
  }
}

function extractRecentFragments(content, count = 10) {
  const sections = content.split(/\r?\n---\r?\n/);
  const titles = [];
  for (const section of sections) {
    const match = section.match(/^## (.+)$/m);
    if (match) titles.push(match[1]);
  }
  return titles.slice(0, count);
}

function extractOpenQuestions(content, count = 5) {
  const sections = content.split(/\r?\n---\r?\n/);
  const open = [];
  for (const section of sections) {
    const match = section.match(/^## (.+)$/m);
    if (match && !match[1].startsWith('✓')) {
      open.push(match[1]);
    }
  }
  return open.slice(0, count);
}

function extractPendingTodos(content) {
  const sections = content.split(/\r?\n---\r?\n/);
  const todos = [];
  for (const section of sections) {
    const match = section.match(/^## (.+)$/m);
    if (match && !match[1].includes('创建于') && !match[1].includes('更新于')) {
      todos.push(match[1]);
    }
  }
  return todos;
}

// --- Check /think state — skip viewer + context injection when OFF ---
const stateFile2 = path.join(TREE, '.think-state');
let thinkOn = false;
try { thinkOn = fs.readFileSync(stateFile2, 'utf-8').trim() === 'on'; } catch {}

if (!thinkOn) process.exit(0);

// --- Web Viewer: auto-start if not running ---
const VIEWER_PORT = 3456;
const VIEWER_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'thinking-tree-server.js');

try {
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, [VIEWER_SCRIPT, String(VIEWER_PORT)], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, USERPROFILE: HOME, HOME: HOME }
  });
  child.unref();
  // Server handles EADDRINUSE gracefully — if already running, new process exits silently
} catch {}

// --- Inject context ---

const fragmentContent = readFile('fragments.md');
const fragments = extractRecentFragments(fragmentContent);
const questions = extractOpenQuestions(readFile('questions.md'));
const todos = extractPendingTodos(readFile('todos.md'));

const hasContent = fragments.length || questions.length || todos.length;
if (!hasContent) process.exit(0);

const lines = ['# [thinking-tree] 近期思考上下文', ''];

if (fragments.length) {
  lines.push(`## 近期碎片（${fragments.length} 条）`);
  fragments.forEach(f => lines.push(`- ${f}`));
  lines.push('');
}

if (questions.length) {
  lines.push(`## 未解问题（${questions.length} 条）`);
  questions.forEach(q => lines.push(`- ${q}`));
  lines.push('');
}

if (todos.length) {
  lines.push(`## 待办行动项（${todos.length} 条）`);
  todos.forEach(t => lines.push(`- ${t}`));
  lines.push('');
}

lines.push('上述内容来自 ~/.thinking-tree/，详情可直接读取对应文件。');
lines.push('');
lines.push(`🌳 Web Viewer: http://localhost:${VIEWER_PORT}/`);

console.log(lines.join('\n'));
