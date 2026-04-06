#!/usr/bin/env node
// thinking-tree UserPromptSubmit hook
// Reads .think-state and injects one line of context per turn

const fs = require('fs');
const path = require('path');

const HOME = process.env.USERPROFILE || process.env.HOME;
const STATE_FILE = path.join(HOME, '.thinking-tree', '.think-state');

let active = false;
try {
  active = fs.readFileSync(STATE_FILE, 'utf-8').trim() === 'on';
} catch {}

if (active) {
  console.log('🌳 /think: ON — 本轮需执行思考记录（见 clarifier 规则）');
} else {
  console.log('🌳 /think: OFF — 本轮跳过思考记录');
}
