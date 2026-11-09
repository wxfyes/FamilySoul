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
  console.log('✅ 伙计真落籍、钱真扣、流水真落');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
