#!/usr/bin/env node
// thinking-tree /think toggle — deterministic, no AI needed
// Syncs rules from plugin, then toggles all plugin rules on/off

const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || process.env.HOME;
const TREE = path.join(HOME, '.thinking-tree');
const RULES_DIR = path.join(HOME, '.claude', 'rules');
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PLUGIN_RULES = path.join(PLUGIN_ROOT, 'rules');
const SESSION_LOG = path.join(TREE, '.session-log.md');

// Collect plugin rule filenames
const pluginRules = [];
try {
  for (const f of fs.readdirSync(PLUGIN_RULES)) {
    if (f.endsWith('.md')) pluginRules.push(f);
  }
} catch { }

if (pluginRules.length === 0) {
  console.log('No plugin rules found.');
  process.exit(1);
}

fs.mkdirSync(RULES_DIR, { recursive: true });

// Detect current state via clarifier.md (primary toggle indicator)
const isOn = fs.existsSync(path.join(RULES_DIR, 'clarifier.md'));

if (isOn) {
  // --- Turn OFF ---
  for (const file of pluginRules) {
    const active = path.join(RULES_DIR, file);
    const off = active + '.off';
    if (fs.existsSync(active)) fs.renameSync(active, off);
  }
  // Clean session log
  try { fs.unlinkSync(SESSION_LOG); } catch { }
  console.log('thinking-tree recording OFF. Session log cleaned.');
} else {
  // --- Turn ON ---
  // First sync content from plugin (update rules to latest version)
  for (const file of pluginRules) {
    const src = path.join(PLUGIN_RULES, file);
    const dest = path.join(RULES_DIR, file);
    const off = dest + '.off';
    // Remove .off version
    try { fs.unlinkSync(off); } catch { }
    // Copy latest from plugin
    fs.writeFileSync(dest, fs.readFileSync(src, 'utf-8'));
  }
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
  } catch { }

  console.log('thinking-tree recording ON. Rules synced to latest version.');
}
