import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { applyChatActions } from '../src/world/chat-actions.js';
import { ensureProjectProperty } from '../src/world/projects.js';

console.log('🧪 给鑫雅阁添伙计，要真落籍、真扣钱、真落账...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-projhire-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  ensureProjectProperty(w, '鑫雅阁', 600, { title: '鑫雅阁开张' });
  ensureProjectProperty(w, '王记粮铺', 100, { title: '王记粮铺开张' });
  if (!w.actors.a_fu) {
    w.actors.a_fu = { id: 'a_fu', name: '阿福', role: '伙计', location: 'tea_house', home: 'tea_house', gender: 'male' };
  } else {
    w.actors.a_fu.location = 'tea_house';
  }
  w.actors.husband.location = 'husband_room';
  w.actors.waner.location = 'husband_room';
  w.assets.silver = 1000;
  const before = Number(w.assets.silver);
  saveState(dir, w);

  const notices = applyChatActions({ world: w, viewerId: 'husband', sayText: '找婉儿给鑫雅阁添三个伙计' });
  const prop = (w.assets.properties || []).find((p) => String(p.name).includes('鑫雅阁'));
  assert.ok(prop, '鑫雅阁产业应在');
  assert.ok(Number(prop.staff) >= 3, '产业人手应 +3，实际：' + prop.staff);
  assert.ok(Number(w.assets.silver) < before, '应真扣安家银');
  assert.ok((w.ledger || []).some((e) => String(e.title).includes('鑫雅阁添伙计')), '应有雇工流水');
  assert.ok(notices.some((n) => n.includes('鑫雅阁添了')), '应有明确提示');

  const n2 = applyChatActions({ world: w, viewerId: 'husband', sayText: '请陈敬堂当鑫雅阁掌柜' });
  const mgr = Object.values(w.actors || {}).find((a) => a && a.name === '陈敬堂');
  assert.ok(mgr, '指名的陈敬堂应真的落籍');
  assert.ok(/掌柜/.test(String(mgr.role || '')), '陈敬堂应任掌柜');
  assert.ok(n2.some((n) => n.includes('陈敬堂')), '应有掌柜到岗提示');

  const n3 = applyChatActions({ world: w, viewerId: 'husband', sayText: '让阿福去粮铺坐柜，雇刘二到粮铺当伙计' });
  console.log('n3=', JSON.stringify(n3));
  console.log('names=', Object.values(w.actors || {}).filter((a) => /阿福|刘二/.test(a.name)).map((a) => [a.name, a.role, a.location]));
  const aFu = Object.values(w.actors || {}).find((a) => a && a.name === '阿福');
  const liu = Object.values(w.actors || {}).find((a) => a && a.name === '刘二');
  const grain = (w.assets.properties || []).find((p) => String(p.name).includes('粮铺'));
  assert.ok(aFu && aFu.location === grain.placeId, '阿福应真调到粮铺');
  assert.ok(liu && liu.location === grain.placeId, '刘二应真雇到粮铺');
  assert.ok(n3.some((n) => n.includes('粮铺')), '应有粮铺到岗提示');
  console.log('✅ 伙计真落籍、指名掌柜/刘二真落籍，钱真扣、流水真落');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
