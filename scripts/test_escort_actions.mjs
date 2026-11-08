import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState } from '../src/world/state.js';
import { applyChatActions } from '../src/world/chat-actions.js';

console.log('🧪 领路必须两人同行（含 awayUntil 中的老板娘）...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-esc-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'goods_shop';
  w.actors.yangcaiyun.location = 'goods_shop';
  w.actors.yangcaiyun.awayUntil = { day: w.clock.day, hour: (w.clock.hour + 3) % 24 };

  const notices = applyChatActions({ world: w, viewerId: 'husband', sayText: '带我去喝茶，老板娘' });
  assert.ok(notices.some((n) => n.includes('清静账房')), '应提示已到清静账房');
  assert.strictEqual(w.actors.husband.location, 'goods_shop__office', '相公应在清静账房');
  assert.strictEqual(w.actors.yangcaiyun.location, 'goods_shop__office', '采云必须同行');
  console.log('✅ 两人一起进了清静账房');

  // 真人角色不能被天道带着走：明确提示，不许硬搬
  w.actors.husband.location = 'goods_shop';
  w.actors.yangcaiyun.location = 'goods_shop';
  w.actors.yangcaiyun.humanBound = true;
  const n2 = applyChatActions({ world: w, viewerId: 'husband', sayText: '带我去喝茶，老板娘' });
  assert.ok(n2.some((n) => n.includes('真人角色')), '应提示她是真人角色');
  assert.strictEqual(w.actors.husband.location, 'goods_shop', '相公不得被单独搬走');
  assert.strictEqual(w.actors.yangcaiyun.location, 'goods_shop', '真人角色不得被搬动');
  console.log('✅ 真人角色只提示、不硬搬');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
