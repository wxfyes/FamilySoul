import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState } from '../src/world/state.js';
import { moveActor } from '../src/world/position.js';

console.log('🧪 领路同行必须能绕过 awayUntil，不能只搬相公...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-away-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'goods_shop';
  w.actors.yangcaiyun.location = 'goods_shop';
  w.actors.yangcaiyun.awayUntil = { day: w.clock.day, hour: (w.clock.hour + 3) % 24 };
  const id = 'goods_shop__office';
  if (!w.places[id]) {
    w.places[id] = { id, name: '翟家货栈·清静账房', parent: 'goods_shop', use: 'office', access: 'private', exits: ['goods_shop'] };
  }

  const mv = moveActor(w, 'yangcaiyun', id, 'world', '随行带路');
  assert.strictEqual(mv.ok, true, '同行领路必须绕过 awayUntil');
  assert.strictEqual(w.actors.yangcaiyun.location, id, '采云必须跟到清静账房');
  console.log('✅ 同行不再被 awayUntil 卡住');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
