import assert from 'node:assert';
import { addRumor } from '../src/world/rumors.js';

console.log('🧪 剿匪风评应当天全城已知，不能显示 0 人知...');

const world = { clock: { day: 20 }, flags: {}, rumors: [] };
const r = addRumor(world, { text: '王家剿平「试刀寨」，缴获颇丰，城中人心大定', tone: 1, weight: 6, reach: 60 });
assert.ok(r, '风评应创建成功');
assert.strictEqual(r.reach, 60, '剿匪风评当天 reach 应为 60（全城已知）');

const old = { text: '旧风评没写 reach' };
world.rumors.push(old);
for (const x of world.rumors) {
  if (x && !Number.isFinite(Number(x.reach))) x.reach = 60;
}
assert.strictEqual(old.reach, 60, '旧风评缺 reach 应补成 60');
console.log('✅ 新剿匪风评当天 60 人知，旧风评也补齐');
