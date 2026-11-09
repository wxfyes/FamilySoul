import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';

console.log('🧪 男乡绅不许自称妾身，也不许代报内部账...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-tone-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  const yuan = Object.values(w.actors || {}).find((a) => a && a.name === '袁叔');
  if (yuan) {
    yuan.gender = 'male';
    yuan.role = '乡绅';
    yuan.location = w.actors.husband.location;
  } else {
    w.actors.yuan_test = { id: 'yuan_test', name: '袁叔', gender: 'male', role: '乡绅', location: w.actors.husband.location, relations: {} };
  }
  saveState(dir, w);

  const out = executeNarrativeTags({
    dataDir: dir, viewerActorId: 'husband', sayText: '袁叔来了啊，吃好喝好啊',
    replyText: '【乡绅·袁叔】：“谢东家！妾身就不客气了。那五十两定金已入柜立账，何大厨的菜单候着，等您点头。”\n这几桩妾身不敢替东家做主，全等您一句话。',
  });
  const reply = String(out.reply || '');
  assert.ok(!/妾身/.test(reply), '男角色不得自称妾身');
  assert.ok(!/定金|入柜|菜单/.test(reply), '客人不得代报内部账');
  assert.ok(/得问掌柜|掌柜/.test(reply), '应把内部账推给掌柜');
  console.log('✅ 性别与内部账都校正了');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
