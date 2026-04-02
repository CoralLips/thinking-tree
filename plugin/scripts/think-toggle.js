#!/usr/bin/env node
// thinking-tree /think toggle — writes state file for per-turn hook
// Rules stay permanently in ~/.claude/rules/, state controls behavior

const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || process.env.HOME;
const TREE = path.join(HOME, '.thinking-tree');
const RULES_DIR = path.join(HOME, '.claude', 'rules');
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PLUGIN_RULES = path.join(PLUGIN_ROOT, 'rules');
const STATE_FILE = path.join(TREE, '.think-state');
const SESSION_LOG = path.join(TREE, '.session-log.md');

fs.mkdirSync(TREE, { recursive: true });
fs.mkdirSync(RULES_DIR, { recursive: true });

// Read current state
let isOn = false;
try {
  isOn = fs.readFileSync(STATE_FILE, 'utf-8').trim() === 'on';
} catch {}

if (isOn) {
  // --- Turn OFF ---
  fs.writeFileSync(STATE_FILE, 'off', 'utf-8');
  try { fs.unlinkSync(SESSION_LOG); } catch {}
  console.log('thinking-tree recording OFF.');
} else {
  // --- Turn ON ---
  fs.writeFileSync(STATE_FILE, 'on', 'utf-8');

  // Sync rules from plugin (ensure latest version in ~/.claude/rules/)
  try {
    for (const file of fs.readdirSync(PLUGIN_RULES)) {
      if (!file.endsWith('.md')) continue;
      const src = path.join(PLUGIN_RULES, file);
      const dest = path.join(RULES_DIR, file);
      const srcContent = fs.readFileSync(src, 'utf-8');
      let destContent = '';
      try { destContent = fs.readFileSync(dest, 'utf-8'); } catch {}
      if (srcContent !== destContent) fs.writeFileSync(dest, srcContent, 'utf-8');
      // Clean up legacy .off files
      try { fs.unlinkSync(dest + '.off'); } catch {}
    }
  } catch {}

  // Start viewer if not already running
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
  } catch {}

  console.log('thinking-tree recording ON. Rules synced to latest version.');
}
