import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState } from '../src/world/state.js';
import { applyChatActions } from '../src/world/chat-actions.js';

console.log('🧪 出门去王宅/酒肆，应到正厅/大堂，不是私房...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-pub-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'goods_shop';
  w.actors.yangcaiyun.location = 'goods_shop';

  applyChatActions({ world: w, viewerId: 'husband', sayText: '带我去酒肆' });
  assert.ok(String(w.actors.husband.location).startsWith('wine_shop'), '酒肆应到酒肆，不是别处');
  assert.notStrictEqual(w.actors.husband.location, 'wine_shop__f2', '不能去二层雅阁');
  assert.notStrictEqual(w.actors.husband.location, 'wine_shop__f3', '不能去三层天字阁');
  console.log('✅ 去酒肆到大堂：' + w.actors.husband.location);

  w.actors.husband.location = 'goods_shop';
  w.actors.yangcaiyun.location = 'goods_shop';
  applyChatActions({ world: w, viewerId: 'husband', sayText: '带我去王宅' });
  const loc = String(w.actors.husband.location);
  const nm = String(w.places?.[loc]?.name || '');
  assert.ok(/丈夫?人?room|husband_room/.test(loc), '应回王宅');
  assert.ok(/中堂|大厅|议事|大门/.test(nm), '回家应到正厅/议事厅/大门，不能直接卧室，实际：' + nm);
  assert.notStrictEqual(loc, 'husband_room', '不能落在正房卧室');
  console.log('✅ 回王宅到：' + nm);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
