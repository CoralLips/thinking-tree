#!/usr/bin/env node
// Atomic writer for thinking-tree items (fragment, question, todo)
// Usage: echo '{"type":"fragment","title":"标题","body":"内容"}' | node write-item.js
//   type: "fragment" | "question" | "todo"
//   title: heading text (without ## prefix)
//   body: content text
// Outputs JSON result to stdout, no other console output.

const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || process.env.HOME;
const TREE = path.join(HOME, '.thinking-tree');
const META_PATH = path.join(TREE, '.meta.json');

const FILES = {
  fragment: 'fragments.md',
  question: 'questions.md',
  todo: 'todos.md',
};

// Read stdin
let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const result = write(data);
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
    process.exit(1);
  }
});

function write(data) {
  const { type, title, body } = data;

  // Validate
  if (!type || !FILES[type]) return { ok: false, error: `unknown type: ${type}` };
  if (!title || !title.trim()) return { ok: false, error: 'missing title' };
  if (!body || !body.trim()) return { ok: false, error: 'missing body' };

  const filePath = path.join(TREE, FILES[type]);
  const today = new Date().toISOString().slice(0, 10);

  // Ensure directory and file exist
  fs.mkdirSync(TREE, { recursive: true });

  // Build entry based on type
  let entry;
  if (type === 'fragment') {
    const meta = readMeta();
    const id = meta.fragments.nextId;
    entry = `\n<!-- frag:${id} date:${today} -->\n## ${title}\n\n${body}\n---\n`;
    meta.fragments.nextId = id + 1;
    meta.fragments.count = (meta.fragments.count || 0) + 1;
    writeMeta(meta);
  } else {
    // question and todo: no ID tracking, just append
    entry = `\n## ${title}\n\n${body}\n---\n`;
  }

  // Atomic append
  fs.appendFileSync(filePath, entry, 'utf-8');

  return { ok: true, type, title, file: FILES[type] };
}

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  } catch {
    return {
      fragments: { count: 0, lastReduceCount: 0, lastReduceDate: null, nextId: 1 },
      sessionLog: { roundCount: 0, lastRecorderRound: 0 },
    };
  }
}

function writeMeta(meta) {
  // Write to temp file then rename for atomicity
  const tmp = META_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmp, META_PATH);
}
