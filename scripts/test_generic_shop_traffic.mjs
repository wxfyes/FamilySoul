import assert from 'node:assert';
import { runBusinessTraffic } from '../src/world/clock.js';

console.log('🧪 全城别的铺子也要有开门/进客/打烊，不只相公产业...');

const world = {
  clock: { day: 21, hour: 12 },
  assets: { properties: [] },
  actors: {
    keeper: { id: 'keeper', name: '张掌柜', role: '掌柜', location: 'rice_shop', home: 'rice_shop' },
    guest: { id: 'guest', name: '王客商', role: '客商', location: 'street', home: 'street' },
  },
  places: {
    street: { id: 'street', name: '青石板长街' },
    rice_shop: { id: 'rice_shop', name: '恒丰米行', openHour: 8, closeHour: 19 },
  },
};

const n = runBusinessTraffic(world);
assert.ok(n >= 1, '别的铺子也该进客');
assert.strictEqual(world.actors.guest.location, 'rice_shop', '客人应进米行');

world.clock.hour = 20;
runBusinessTraffic(world);
assert.strictEqual(world.actors.guest.location, 'street', '米行打烊应散客');
console.log('✅ 全城铺子按自己时辰开门、进客、打烊');
