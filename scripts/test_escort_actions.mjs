import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState } from '../src/world/state.js';
import { applyChatActions } from '../src/world/chat-actions.js';
import { markHumanSeen, clearHumanSeen } from '../src/world/presence.js';

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

  // 通用场所：没有现成雅间就现开一间，不能只认货栈
  w.places.test_inn = { id: 'test_inn', name: '同福客栈', exits: ['street'], use: 'place', access: 'public_shop' };
  w.actors.husband.location = 'test_inn';
  w.actors.yangcaiyun.location = 'test_inn';
  w.actors.yangcaiyun.humanBound = false;
  const nInn = applyChatActions({ world: w, viewerId: 'husband', sayText: '带我去找个清静地方' });
  assert.ok(nInn.some((n) => n.includes('同福客栈·雅间')), '通用场所应现开雅间');
  assert.strictEqual(w.actors.husband.location, 'test_inn__parlor', '相公应在同福客栈雅间');
  assert.strictEqual(w.actors.yangcaiyun.location, 'test_inn__parlor', '同伴应同行');
  console.log('✅ 通用场所也能开雅间同行');

  // 点名"去茶坊"：必须去茶坊，不能被"王宅"通用逻辑带进书斋
  w.actors.husband.location = 'husband_room__study';
  w.actors.waner.location = 'husband_room__study';
  const nTea = applyChatActions({ world: w, viewerId: 'husband', sayText: '带我去茶坊，婉儿' });
  assert.ok(nTea.some((n) => n.includes('茶坊')), '应提示到了茶坊');
  assert.strictEqual(w.actors.husband.location, 'tea_house', '相公应到茶坊');
  assert.strictEqual(w.actors.waner.location, 'tea_house', '婉儿应同行到茶坊');
  console.log('✅ 点名去茶坊，不会被书斋截走');

  // 离线真人：同一场所内允许同行
  w.actors.husband.location = 'goods_shop';
  w.actors.yangcaiyun.location = 'goods_shop';
  w.actors.yangcaiyun.humanBound = true;
  clearHumanSeen('yangcaiyun');
  const n2 = applyChatActions({ world: w, viewerId: 'husband', sayText: '带我去喝茶，老板娘' });
  assert.ok(n2.some((n) => n.includes('清静账房')), '离线真人应能同场所同行');
  assert.strictEqual(w.actors.yangcaiyun.location, 'goods_shop__office', '采云必须同行');
  console.log('✅ 离线真人可同场所同行');

  // 在线真人：不许代走，只提示去找她
  w.actors.husband.location = 'goods_shop';
  w.actors.yangcaiyun.location = 'goods_shop';
  markHumanSeen('yangcaiyun');
  const n3 = applyChatActions({ world: w, viewerId: 'husband', sayText: '带我去喝茶，老板娘' });
  assert.ok(n3.some((n) => n.includes('真人')), '在线真人应提示不能同行');
  assert.strictEqual(w.actors.husband.location, 'goods_shop', '相公不得被单独搬走');
  assert.strictEqual(w.actors.yangcaiyun.location, 'goods_shop', '在线真人不得被搬动');
  clearHumanSeen('yangcaiyun');
  console.log('✅ 在线真人只提示、不代走');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
