import assert from 'node:assert';
import { loadState, saveState } from '../src/world/state.js';
import { applyWorldTags } from '../src/world/dispatch.js';

const dataDir = 'data';
const w = loadState(dataDir);

// 1. 测试天道造人：造一个"陈郎中"
const spawnOps = [{
  kind: 'spawn',
  args: { name: '陈郎中', role: '回春堂大夫', gender: 'male', goals: '悬壶济世' }
}];

const appliedSpawn = applyWorldTags(dataDir, spawnOps, { selfId: 'husband' });
console.log('Applied spawn:', appliedSpawn);

const wAfterSpawn = loadState(dataDir);
const chen = Object.values(wAfterSpawn.actors).find((a) => a && a.name === '陈郎中');
assert(chen, '必须成功造出陈郎中');
assert(chen.home, '陈郎中必须有 home，不可露宿街头');
assert(chen.location, '陈郎中必须有 location');
assert(Array.isArray(chen.schedule) && chen.schedule.length > 0, '陈郎中必须有 schedule 作息');
console.log('✅ 天道造人成功：落脚处与作息完整，home =', chen.home);

// 2. 测试天道造物：新开一间"城南生药铺"
const propOps = [{
  kind: 'property',
  args: { name: '城南生药铺', set: 3.5, status: '正常营业', city: '临江府' }
}];

const appliedProp = applyWorldTags(dataDir, propOps, { selfId: 'husband' });
console.log('Applied prop:', appliedProp);

const wAfterProp = loadState(dataDir);
const pharmacy = (wAfterProp.assets.properties || []).find((p) => p && p.name === '城南生药铺');
assert(pharmacy, '必须成功开出城南生药铺');
assert.strictEqual(pharmacy.incomePerDay, 3.5, '日入必须为 3.5 两');
assert.strictEqual(pharmacy.owner, 'husband', '归属权必须为 husband');
console.log('✅ 天道造物成功：新产业开张与归属完整，owner =', pharmacy.owner);

console.log('🎉 天道造人造物全部真实生效！');

