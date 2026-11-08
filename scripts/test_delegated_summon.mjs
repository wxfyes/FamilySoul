import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState } from '../src/world/state.js';
import { applyChatActions } from '../src/world/chat-actions.js';

console.log('🧪 让陈二去叫周有财，周有财必须真的到跟前...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-call-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'tea_house';
  w.actors.chener = w.actors.chener || { id: 'chener', name: '陈二', role: '伙计', location: 'tea_house', home: 'tea_house' };
  w.actors.chener.location = 'tea_house';
  w.actors.npc_accountant_zhou = w.actors.npc_accountant_zhou || { id: 'npc_accountant_zhou', name: '周有财', role: '账房', location: 'goods_shop', home: 'goods_shop' };
  w.actors.npc_accountant_zhou.location = 'goods_shop';

  const n = applyChatActions({ world: w, viewerId: 'husband', sayText: '去吧周有财叫来' });
  assert.ok(w.actors.npc_accountant_zhou.location === 'tea_house', '周有财应被叫到跟前，实际：' + w.actors.npc_accountant_zhou.location);
  assert.strictEqual(w.actors.chener.location, 'tea_house', '陈二仍是跑腿的，不该被当成周有财');
  assert.ok(n.length >= 1, '应给一条提示');
  console.log('✅ 陈二去叫，周有财真到了跟前');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
