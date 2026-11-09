import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { applyChatActions } from '../src/world/chat-actions.js';
import { ensureProjectProperty } from '../src/world/projects.js';

console.log('🧪 请柳含烟到鑫雅阁当头牌，要真进产业，不能当成送客...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-headliner-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  ensureProjectProperty(w, '鑫雅阁', 600, { title: '鑫雅阁开张' });
  w.actors.husband.location = 'husband_room';
  w.actors.npc_34 = {
    id: 'npc_34', name: '柳含烟', role: '说书女先生', location: 'tea_house',
    home: 'tea_house', gender: 'female', money: 0, relations: {},
  };
  w.assets.silver = 1000;
  saveState(dir, w);

  const notices = applyChatActions({ world: w, viewerId: 'husband', sayText: '请柳含烟到鑫雅阁当头牌，月银一两八钱' });
  const prop = (w.assets.properties || []).find((p) => String(p.name).includes('鑫雅阁'));
  const actor = w.actors.npc_34;
  assert.strictEqual(actor.role, '头牌', '应改任头牌');
  assert.strictEqual(actor.location, prop.placeId, '应真到鑫雅阁');
  assert.ok((prop.staffIds || []).includes('npc_34'), '应进产业名册');
  assert.ok(notices.some((n) => n.includes('柳含烟') && n.includes('鑫雅阁')), '应有到岗提示');
  console.log('✅ 柳含烟真进了鑫雅阁，头牌名册已落');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
