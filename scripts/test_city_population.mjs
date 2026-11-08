import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';

console.log('🧪 按城等级补市井人口，小城不能只有几个人...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-citypop-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.cities = w.cities || {};
  w.cities['测试府'] = { wealth: 30, owner: 'court', defense: 20, unrest: 10 };
  w.places['测试_street'] = { id: '测试_street', name: '测试府·主街', exits: [] };
  w.places['测试_market'] = { id: '测试_market', name: '测试府·集市', exits: ['测试_street'] };
  w.flags = w.flags || {};
  w.flags.cityBase = w.flags.cityBase || {};
  w.flags.cityBase['测试府'] = { streetId: '测试_street', marketId: '测试_market' };
  saveState(dir, w);

  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-citypop2-'));
  fs.mkdirSync(path.join(dir2, 'world'), { recursive: true });
  fs.copyFileSync(path.join(dir, 'world', 'state.json'), path.join(dir2, 'world', 'state.json'));
  const got = loadState(dir2);
  const folk = Object.values(got.actors).filter((a) => a && a.city === '测试府' && a.origin === 'city_folk');
  assert.ok(folk.length >= 8, '小城至少补到 12 人规模，实际新增：' + folk.length);
  assert.ok(folk.every((a) => Array.isArray(a.schedule) && a.schedule.length > 0), '每个市井人都要有作息');
  assert.ok(folk.every((a) => Array.isArray(a.goals) && a.goals.length > 0), '每个市井人都要有心愿');
  const names = folk.map((a) => a.name);
  assert.strictEqual(new Set(names).size, names.length, '同城市井人名字不能重复');
  console.log(`✅ 测试府补了 ${folk.length} 个市井人，有作息有心愿`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
