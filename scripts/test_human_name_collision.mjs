import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';
import { ensureProjectProperty } from '../src/world/projects.js';
import { hireStaff } from '../src/world/employment.js';

console.log('🧪 真人柳如烟不能被买成 NPC，也不能重复起名...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-namecol-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.flags = w.flags || {};
  w.flags.humanActors = ['yangcaiyun'];
  w.actors.yangcaiyun.name = '柳如烟';
  w.actors.yangcaiyun.humanBound = true;
  ensureProjectProperty(w, '鑫雅阁', 600, { title: '鑫雅阁开张' });
  w.assets.silver = 1000;
  saveState(dir, w);
  const before = Number(loadState(dir).assets.silver);

  const out = executeNarrativeTags({
    dataDir: dir, viewerActorId: 'husband', sayText: '定下柳如烟当头牌',
    replyText: '好。[[pay:柳如烟头牌安家|安家=1.8]]',
  });
  const after = loadState(dir);
  assert.strictEqual(after.assets.silver, before, '真人重名不能扣安家银');
  assert.ok(String(out.reply || '').includes('真人角色'), '应提示重名拦截');

  const r = hireStaff(after, { propName: '鑫雅阁', name: '柳如烟', role: '头牌' });
  assert.strictEqual(r.ok, false, '真人重名不能雇');
  assert.ok(/真人|名字/.test(String(r.error || '')), '应给出重名原因');
  console.log('✅ 真人重名被拦，钱没扣');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
