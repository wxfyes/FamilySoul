import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { applyChatActions } from '../src/world/chat-actions.js';

console.log('🧪 一句话里招人、调人、约定提醒，统一意图入口要逐件落实...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-intent-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'husband_room';
  w.actors.waner.location = 'husband_room';
  const wanning = Object.values(w.actors).find((a) => a && a.name === '崔婉宁');
  wanning.household = true;
  wanning.spouse = 'husband';
  w.assets.silver = 1000;
  saveState(dir, w);

  // 约定：明天上午，和婉宁回门，到点提醒
  const n = applyChatActions({ world: w, viewerId: 'husband', sayText: '明天上午记得提醒我和婉宁回门' });
  const ap = (w.appointments || []).find((x) => x && /回门/.test(String(x.text)));
  assert.ok(ap, '应生成回门约定');
  assert.strictEqual(ap.name, '崔婉宁', '约定应落到崔婉宁');
  assert.strictEqual(ap.hour, 10, '上午应是 10 时');
  assert.ok(n.some((x) => /记下了/.test(x)), '应有记下提醒的回执');

  const n2 = applyChatActions({ world: w, viewerId: 'husband', sayText: '明天下午提醒我和婉宁回门' });
  const aps = (w.appointments || []).filter((x) => x && /回门/.test(String(x.text)));
  assert.strictEqual(aps.length, 1, '改时间应更新同一条约定，不新增');
  assert.strictEqual(aps[0].hour, 14, '下午应改到 14 时');
  assert.ok(n2.some((x) => /改到/.test(x)), '应有改时间回执');
  console.log('✅ 一句话里的约定提醒已真落盘，且能改到下午');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
