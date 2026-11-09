import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';

console.log('🧪 老丈不能来月事；侧室必须有婚书名分...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-sanity-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.zhangbo_test = {
    id: 'zhangbo_test', name: '张伯', role: '邻家老丈', gender: 'female',
    location: 'street', home: 'street', onPeriod: true, cycleDay: 3,
    menses: { on: true, cycleDay: 3 },
  };
  w.places.wang_mansion_east = { id: 'wang_mansion_east', name: '临江·王宅·东跨院', exits: ['husband_room'] };
  w.actors.cui_test = {
    id: 'cui_test', name: '崔婉宁', role: '侧室', gender: 'female',
    location: 'wang_mansion_east', home: 'wang_mansion_east', spouse: null,
    marital: 'concubine',
  };
  saveState(dir, w);
  // 另起一份目录，确保走真正的读档迁移（进程重启时同样）
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-sanity2-'));
  fs.mkdirSync(path.join(dir2, 'world'), { recursive: true });
  fs.copyFileSync(path.join(dir, 'world', 'state.json'), path.join(dir2, 'world', 'state.json'));
  const got = loadState(dir2);
  assert.strictEqual(got.actors.zhangbo_test.gender, 'male', '老丈应纠正为男');
  assert.ok(!got.actors.zhangbo_test.onPeriod, '男性不得有月事');
  assert.ok(!got.actors.zhangbo_test.menses, '男性不得保留 menses 周期');
  assert.strictEqual(got.actors.cui_test.spouse, 'husband', '侧室应记 spouse');
  assert.strictEqual(got.actors.cui_test.marital, 'concubine', '侧室名分应为妾');
  assert.ok((got.marriages || []).some((m) => m && m.who === 'cui_test'), '侧室应进婚书');
  console.log('✅ 性别与婚书名分都已纠正');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
