import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState } from '../src/world/state.js';
import { applyChatActions } from '../src/world/chat-actions.js';

console.log('🧪 暗号约定：到对的地方说对暗号，人才会来...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-sig-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  assert.ok(w.places['goods_shop__backdoor'], '货栈后门必须是真实地点');
  w.actors.husband.location = 'goods_shop__backdoor';
  w.actors.yangcaiyun.location = 'goods_shop';
  w.actors.yangcaiyun.humanBound = false;
  w.signals = [{
    id: 'sig_test', actorId: 'yangcaiyun', actorName: '杨采云', signal: '三短一长',
    placeId: 'goods_shop__backdoor', placeName: '翟家货栈·后门', active: true,
  }];

  const n = applyChatActions({ world: w, viewerId: 'husband', sayText: '我在后门敲了三短一长' });
  assert.ok(n.some((x) => x.includes('暗号')), '应提示暗号对上');
  assert.strictEqual(w.actors.yangcaiyun.location, 'goods_shop__backdoor', '她应到后门来');
  assert.strictEqual(w.signals[0].active, false, '暗号用一次就该失效');
  console.log('✅ 暗号对上，人真来了');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
