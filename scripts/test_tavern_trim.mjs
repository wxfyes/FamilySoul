import assert from 'node:assert';
import { buildPremises } from '../src/world/residence.js';

console.log('🧪 于家酒肆不是三层酒楼，二层/三层应被清掉...');

const world = {
  clock: { day: 20, hour: 12 },
  actors: {
    husband: { id: 'husband', name: '王甯', location: 'wine_shop' },
    liuwenxia: { id: 'liuwenxia', name: '刘文霞', location: 'wine_shop__f2' },
  },
  places: {
    street: { id: 'street', name: '青石板长街' },
    wine_shop: {
      id: 'wine_shop', name: '于家酒肆', exits: ['street'],
      rooms: {
        f1: { id: 'wine_shop__f1', name: '一层大堂' },
        f2: { id: 'wine_shop__f2', name: '二层雅阁' },
        f3: { id: 'wine_shop__f3', name: '三层天字阁' },
      },
    },
    wine_shop__f1: { id: 'wine_shop__f1', name: '于家酒肆·一层大堂', parent: 'wine_shop' },
    wine_shop__f2: { id: 'wine_shop__f2', name: '于家酒肆·二层雅阁', parent: 'wine_shop' },
    wine_shop__f3: { id: 'wine_shop__f3', name: '于家酒肆·三层天字阁', parent: 'wine_shop' },
  },
};

buildPremises(world);
assert.ok(!world.places.wine_shop.rooms.f2, '二层雅阁必须删除');
assert.ok(!world.places.wine_shop.rooms.f3, '三层天字阁必须删除');
assert.ok(!world.places.wine_shop__f2, '二层地点实体必须删除');
assert.ok(!world.places.wine_shop__f3, '三层地点实体必须删除');
assert.strictEqual(world.actors.liuwenxia.location, 'wine_shop', '楼上的人必须请回前堂');
assert.strictEqual(world.places.wine_shop.rooms.f1.name, '前堂酒座', '一层应改成前堂酒座');
console.log('✅ 酒肆只剩前堂，没有三层天字阁');
