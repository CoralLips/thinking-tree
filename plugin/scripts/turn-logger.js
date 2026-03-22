#!/usr/bin/env node
// thinking-tree Stop hook (command, async)
// Logger: parse transcript → append session-log → mark pending review
// Zero blocking — runs in background after each AI response

const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || process.env.HOME;
const TREE = path.join(HOME, '.thinking-tree');
const SESSION_LOG = path.join(TREE, '.session-log.md');
const META_PATH = path.join(TREE, '.meta.json');
const PENDING_PATH = path.join(TREE, '.pending-review');
const MAX_ROUNDS = 15;

// --- Read stdin (Stop hook provides JSON) ---
let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    run(data);
  } catch {
    // stdin not valid JSON — still try to log
    run({});
  }
});

function run(data) {
  const transcriptPath = data.transcript_path || '';
  const lastAiMsg = data.last_assistant_message || '';
  const sessionId = data.session_id || 'unknown';

  // --- Extract user message from transcript JSONL ---
  const userMsg = extractLastUserMessage(transcriptPath);

  // --- Read/update meta ---
  const meta = readMeta();
  const roundNum = (meta.sessionLog.roundCount || 0) + 1;
  meta.sessionLog.roundCount = roundNum;
  writeMeta(meta);

  // --- Append to session log ---
  const now = new Date();
  const ts = now.toISOString().slice(0, 16).replace('T', ' ');
  const userLine = truncate(firstLine(userMsg), 120);
  const aiLine = truncate(firstLine(lastAiMsg), 120);

  const entry = [
    `## Round ${roundNum}（${ts} | ${sessionId.slice(0, 8)}）`,
    `用户：${userLine}`,
    `AI：${aiLine}`,
    '---',
    '',
  ].join('\n');

  fs.mkdirSync(TREE, { recursive: true });
  if (!fs.existsSync(SESSION_LOG)) {
    fs.writeFileSync(SESSION_LOG, '# Session Log\n\n', 'utf-8');
  }
  fs.appendFileSync(SESSION_LOG, entry, 'utf-8');

  // --- Trim session log (FIFO, keep last MAX_ROUNDS) ---
  trimSessionLog();

  // --- Mark pending review ---
  let pending;
  try {
    pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf-8'));
    pending.rounds++;
  } catch {
    pending = { rounds: 1, since: now.toISOString() };
  }
  if (transcriptPath) pending.transcriptPath = transcriptPath;
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + '\n', 'utf-8');
}

// --- Helpers ---

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  } catch {
    return {
      fragments: { count: 0, lastReduceCount: 0, lastReduceDate: null, nextId: 1 },
      sessionLog: { roundCount: 0, lastRouterRound: 0 },
    };
  }
}

function writeMeta(meta) {
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
}

function extractLastUserMessage(transcriptPath) {
  if (!transcriptPath) return '(no transcript)';
  try {
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');
    // Search from end for last user message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        // Handle multiple possible JSONL formats
        const isUser =
          entry.type === 'user' ||
          entry.type === 'human' ||
          entry.role === 'user' ||
          entry.role === 'human';
        if (!isUser) continue;

        // Extract text from content (string or array)
        const c = entry.content || entry.message?.content || '';
        if (typeof c === 'string') return c;
        if (Array.isArray(c)) {
          return c
            .filter(p => p.type === 'text')
            .map(p => p.text)
            .join(' ');
        }
        return String(c);
      } catch {
        // skip unparseable lines
      }
    }
  } catch {
    // transcript read failure
  }
  return '(unable to extract)';
}

function trimSessionLog() {
  try {
    const content = fs.readFileSync(SESSION_LOG, 'utf-8');
    const roundStarts = [];
    const regex = /^## Round /gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      roundStarts.push(match.index);
    }
    if (roundStarts.length <= MAX_ROUNDS) return;
    const header = content.slice(0, roundStarts[0]);
    const keepFrom = roundStarts[roundStarts.length - MAX_ROUNDS];
    fs.writeFileSync(SESSION_LOG, header + content.slice(keepFrom), 'utf-8');
  } catch {
    // non-fatal
  }
}

function firstLine(s) {
  return (s || '').split('\n').find(l => l.trim()) || '';
}

function truncate(s, max) {
  return s.length > max ? s.slice(0, max) + '...' : s;
}
