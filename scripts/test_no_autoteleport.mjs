import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseIntent } from '../src/world/intent.js';
import { applyAction } from '../src/world/apply.js';
import { loadState, saveState } from '../src/world/state.js';

console.log('🧪 外客找相公不得把相公瞬移去茶坊...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-notp-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'husband_room';
  w.actors.yangcaiyun.location = 'goods_shop';
  saveState(dir, w);

  const intent = parseIntent({ text: '去找王甯', actorId: 'yangcaiyun', world: w });
  applyAction({ dataDir: dir, world: w, intent, verdict: {} });
  const after = loadState(dir);

  assert.strictEqual(after.actors.husband.location, 'husband_room', '相公不得被聊天/找人瞬移出正房');
  assert.notStrictEqual(after.actors.yangcaiyun.location, 'husband_room', '外客不得直接进入内室');
  console.log('✅ 相公留在正房，外客止步于门厅');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
