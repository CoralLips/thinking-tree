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
  // Skip if /think is OFF (clarifier.md not active)
  const rulesDir = path.join(HOME, '.claude', 'rules');
  if (!fs.existsSync(path.join(rulesDir, 'clarifier.md'))) return;

  // Debounce: skip if last run was < 5 seconds ago (prevents feedback loops)
  const LOCK_FILE = path.join(TREE, '.logger-lock');
  try {
    const stat = fs.statSync(LOCK_FILE);
    if (Date.now() - stat.mtimeMs < 5000) return; // Too soon, skip
  } catch { /* no lock file, proceed */ }
  try { fs.writeFileSync(LOCK_FILE, String(Date.now())); } catch { /* non-fatal */ }

  const transcriptPath = data.transcript_path || '';
  const lastAiMsg = data.last_assistant_message || '';
  const sessionId = data.session_id || 'unknown';

  // Skip loop responses: if AI message is very short, it's likely a feedback loop artifact
  const stripped = lastAiMsg.replace(/[\s\u{1F300}-\u{1FAFF}]/gu, '');
  if (stripped.length < 5) return;

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

  // Silent — no console output to avoid triggering AI response loops
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
    // User text lives in queue-operation/enqueue entries, NOT in type:"user" (those are tool_results)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'queue-operation' && entry.operation === 'enqueue') {
          const c = entry.content || '';
          if (typeof c === 'string' && c.trim()) return c;
        }
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
    const regex = /^\r?## Round /gm;
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
