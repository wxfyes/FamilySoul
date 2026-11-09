import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';

console.log('🧪 扣过“鑫雅阁开张”的钱，产业总览必须真有这间...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-projprop-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.ledger = Array.isArray(w.ledger) ? w.ledger : [];
  w.ledger.push({ day: 21, hour: 20, delta: -600, title: '鑫雅阁开张', by: 'husband', balance: 10000 });
  saveState(dir, w);

  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-projprop2-'));
  fs.mkdirSync(path.join(dir2, 'world'), { recursive: true });
  fs.copyFileSync(path.join(dir, 'world', 'state.json'), path.join(dir2, 'world', 'state.json'));
  const got = loadState(dir2);
  const prop = (got.assets?.properties || []).find((p) => String(p.name || '').includes('鑫雅阁'));
  assert.ok(prop, '应补建鑫雅阁产业');
  assert.ok(got.places?.[prop.placeId], '产业必须有真实地点');
  assert.strictEqual(Number(prop.floors), 2, '鑫雅阁应为二层');
  assert.ok(got.places[`${prop.placeId}__f2`], '二层雅间必须是真实地点');
  console.log('✅ 鑫雅阁已入产业总览，二层雅间是真的');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
