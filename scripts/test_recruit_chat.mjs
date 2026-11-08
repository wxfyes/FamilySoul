import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { applyChatActions } from '../src/world/chat-actions.js';

console.log('🧪 说“招两个家丁吧”，必须真招人、真落账...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-recruit-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'husband_room';
  w.actors.waner.location = 'husband_room';
  w.assets.silver = 500;
  w.factions = w.factions || {};
  const f = (w.factions.wangjia = w.factions.wangjia || { id: 'wangjia', leader: 'husband' });
  f.grain = 500;
  f.guards = Number(f.guards) || 0;
  const before = f.guards;
  const beforeActors = Object.values(w.actors || {}).filter((a) => a && /家丁/.test(String(a.role || ''))).length;
  const silverBefore = w.assets.silver;
  saveState(dir, w);

  const notices = applyChatActions({ world: w, viewerId: 'husband', sayText: '招两个家丁吧' });
  assert.ok(notices.some((n) => n.includes('应声去办')), '应真的去招，而不是被“吧”判成拒绝：' + JSON.stringify(notices));
  const afterActors = Object.values(w.actors || {}).filter((a) => a && /家丁/.test(String(a.role || ''))).length;
  assert.ok(afterActors > beforeActors, '家丁应真的落籍入府');
  assert.ok(w.assets.silver < silverBefore, '安家银应真的扣');
  assert.ok((w.ledger || []).some((e) => String(e.title).includes('招家丁')), '扣钱必须有流水');
  console.log('✅ 真招人、真扣钱、真落账');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
