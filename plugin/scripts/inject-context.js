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

try { syncRules(); } catch (e) { /* non-fatal */ }

// --- Session log cleanup ---
// FIFO queue: keep only the most recent MAX_ROUNDS rounds
const MAX_ROUNDS = 15;

function trimSessionLog() {
  const logPath = path.join(TREE, '.session-log.md');
  if (!fs.existsSync(logPath)) return;

  const content = fs.readFileSync(logPath, 'utf-8');

  // Find all ## Round positions
  const roundStarts = [];
  const regex = /^## Round /gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    roundStarts.push(match.index);
  }

  if (roundStarts.length <= MAX_ROUNDS) return;

  // Keep header (everything before first round) + last MAX_ROUNDS rounds
  const header = content.slice(0, roundStarts[0]);
  const keepFrom = roundStarts[roundStarts.length - MAX_ROUNDS];
  fs.writeFileSync(logPath, header + content.slice(keepFrom), 'utf-8');
}

try { trimSessionLog(); } catch (e) { /* non-fatal */ }

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
const REDUCE_THRESHOLD = 20; // new fragments since last /reduce

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  } catch {
    return { fragments: { count: 0, lastReduceCount: 0, lastReduceDate: null }, sessionLog: { roundCount: 0 } };
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

// Reduce threshold check
const newSinceReduce = currentFragmentCount - (meta.fragments.lastReduceCount || 0);
if (newSinceReduce >= REDUCE_THRESHOLD) {
  const lastDate = meta.fragments.lastReduceDate || '从未';
  lines.push(`⚠️ 碎片池已有 ${currentFragmentCount} 条（上次整理：${lastDate}，新增 ${newSinceReduce} 条），建议运行 /reduce 整理`);
  lines.push('');
}

lines.push('上述内容来自 ~/.thinking-tree/，详情可直接读取对应文件。');

console.log(lines.join('\n'));
