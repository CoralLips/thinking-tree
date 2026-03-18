#!/usr/bin/env node
// thinking-tree context injection for SessionStart hook
// Reads recent fragments, open questions, and todos
// Outputs formatted context for AI session injection

const fs = require('fs');
const path = require('path');

const TREE = path.join(process.env.USERPROFILE || process.env.HOME, '.thinking-tree');

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

// --- Main ---

const fragments = extractRecentFragments(readFile('fragments.md'));
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

console.log(lines.join('\n'));
