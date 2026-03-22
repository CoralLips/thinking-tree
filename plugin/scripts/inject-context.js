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

lines.push('上述内容来自 ~/.thinking-tree/，详情可直接读取对应文件。');

// --- Pending review: trigger background Recorder ---
const PENDING_PATH = path.join(TREE, '.pending-review');
try {
  if (fs.existsSync(PENDING_PATH)) {
    const pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf-8'));
    const n = pending.rounds || 0;
    if (n > 0) {
      lines.push('');
      lines.push(`⚡ RECORDER 触发：有 ${n} 轮未处理的对话记录。`);
      lines.push('请在回复用户之前，使用 Agent tool 启动后台 Recorder：');
      lines.push('Agent(run_in_background: true, description: "后台 Recorder", prompt: 下方 prompt)');
      lines.push('');
      lines.push('--- RECORDER PROMPT START ---');
      lines.push('你是 thinking-tree 后台 Recorder agent。');
      lines.push('');
      lines.push('## Recorder');
      lines.push(`读取 ~/.thinking-tree/.session-log.md 的最新 ${n} 条记录（从末尾往前数 ${n} 个 "## Round" 段落）。`);
      lines.push('逐条评估：有独立的新观点/认知/发现 → 捕获；纯工程操作/重复 → 跳过。');
      lines.push('捕获时追加到 ~/.thinking-tree/fragments.md 末尾：');
      lines.push('- 先读 ~/.thinking-tree/.meta.json 获取 fragments.nextId');
      lines.push('- 格式：<!-- frag:N date:YYYY-MM-DD --> 换行 ## #标签 标题（日期）换行 内容 换行 ---');
      lines.push('- 每写一条：.meta.json 的 count++ 和 nextId++');
      lines.push('');
      lines.push('## Router（可选）');
      lines.push('读 .meta.json，检查 fragments.count - lastReduceCount >= 20 或 roundCount - lastRouterRound >= 10。');
      lines.push('满足任一 → 列出 ~/.thinking-tree/*.md（排除 fragments/questions/todos/.session-log），');
      lines.push('逐条碎片判断是否与某思路文件高度匹配，匹配的搬运过去并从 fragments.md 删除。');
      lines.push('更新 .meta.json 的 lastReduceCount 和 lastRouterRound。');
      lines.push('');
      lines.push('## 完成后');
      lines.push('更新 .meta.json，删除 ~/.thinking-tree/.pending-review。');
      lines.push('--- RECORDER PROMPT END ---');
    }
  }
} catch { /* non-fatal */ }

console.log(lines.join('\n'));
