import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';

console.log('🧪 才女/公子/富商应有心愿与作息（本地规则，不耗模型）...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-citylife-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.test_poetess = {
    id: 'test_poetess', name: '骆兰', role: '才女', gender: 'female', age: 18,
    home: 'street', location: 'street', origin: 'city_class', money: 12,
  };
  w.actors.test_tycoon = {
    id: 'test_tycoon', name: '史郎', role: '富商', gender: 'male', age: 42,
    home: 'street', location: 'market', origin: 'city_class', money: 400,
  };
  saveState(dir, w);

  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-citylife2-'));
  fs.mkdirSync(path.join(dir2, 'world'), { recursive: true });
  fs.copyFileSync(path.join(dir, 'world', 'state.json'), path.join(dir2, 'world', 'state.json'));
  const got = loadState(dir2);
  const poet = got.actors.test_poetess;
  const tycoon = got.actors.test_tycoon;
  assert.ok(Array.isArray(poet.schedule) && poet.schedule.length >= 3, '才女应有作息');
  assert.ok(Array.isArray(poet.goals) && poet.goals.length > 0, '才女应有心愿');
  assert.ok(Array.isArray(tycoon.schedule) && tycoon.schedule.length >= 3, '富商应有作息');
  assert.ok(Array.isArray(tycoon.goals) && tycoon.goals.length > 0, '富商应心愿');
  console.log('✅ 心愿与作息已落，到点会自己走动');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
