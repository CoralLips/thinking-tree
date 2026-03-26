#!/usr/bin/env node
// thinking-tree SessionStart hook
// 1. Sync rules from plugin to ~/.claude/rules/
// 2. Inject recent fragments, questions, todos as context

const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || process.env.HOME;
const TREE = path.join(HOME, '.thinking-tree');
const RULES_DIR = path.join(HOME, '.claude', 'rules');
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');

// --- Rules sync ---
// Copy plugin rules to ~/.claude/rules/ (single source of truth)
// Skip clarifier.md if .off exists (user toggled off via /think)
function syncRules() {
  const pluginRules = path.join(PLUGIN_ROOT, 'rules');
  if (!fs.existsSync(pluginRules)) return;

  fs.mkdirSync(RULES_DIR, { recursive: true });

  for (const file of fs.readdirSync(pluginRules)) {
    if (!file.endsWith('.md')) continue;
    const src = path.join(pluginRules, file);
    const dest = path.join(RULES_DIR, file);
    const offDest = dest + '.off';

    // If user toggled off (e.g. clarifier.md.off exists), don't overwrite
    if (fs.existsSync(offDest)) continue;

    // Copy if missing or outdated
    const srcContent = fs.readFileSync(src, 'utf-8');
    let destContent = '';
    try { destContent = fs.readFileSync(dest, 'utf-8'); } catch {}
    if (srcContent !== destContent) {
      fs.writeFileSync(dest, srcContent, 'utf-8');
    }
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
    fs.writeFileSync(
      path.join(TREE, '.meta.json'),
      JSON.stringify({ fragments: { count: 0, lastReduceCount: 0, lastReduceDate: null, nextId: 1 }, sessionLog: { roundCount: 0, lastRouterRound: 0 } }, null, 2) + '\n',
      'utf-8'
    );
    console.log('🌳 [thinking-tree] initialized ~/.thinking-tree/ — use /think to enable recording');
  }
} catch (e) {
  console.error(`🌳 [thinking-tree] init failed: ${e.message}`);
}

// Session log trimming moved to turn-logger.js (Stop hook)

function readFile(name) {
  try {
    return fs.readFileSync(path.join(TREE, name), 'utf-8');
  } catch {
    return '';
  }
}

function extractRecentFragments(content, count = 10) {
  const titles = content.match(/^## #.+$/gm) || [];
  return titles.slice(-count).map(t => t.replace(/^## /, ''));
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
  return open.slice(-count);
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

// --- Meta: read and update fragment count ---
const META_PATH = path.join(TREE, '.meta.json');

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  } catch {
    return { fragments: { count: 0, lastReduceCount: 0, lastReduceDate: null, nextId: 1 }, sessionLog: { roundCount: 0, lastRouterRound: 0 } };
  }
}

function writeMeta(meta) {
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
}

// --- Main ---

const fragmentContent = readFile('fragments.md');
const fragments = extractRecentFragments(fragmentContent);
const questions = extractOpenQuestions(readFile('questions.md'));
const todos = extractPendingTodos(readFile('todos.md'));

// Update meta with current fragment count (use HTML annotations for reliable counting)
const currentFragmentCount = (fragmentContent.match(/<!-- frag:\d+/g) || []).length;
const meta = readMeta();
meta.fragments.count = currentFragmentCount;
writeMeta(meta);

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

lines.push('');
lines.push(`🌳 Web Viewer: http://localhost:${VIEWER_PORT}/`);


console.log(lines.join('\n'));
