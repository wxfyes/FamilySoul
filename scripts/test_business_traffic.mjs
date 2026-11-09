import assert from 'node:assert';
import { runBusinessTraffic } from '../src/world/clock.js';

console.log('🧪 开门后街上公子该进店，打烊该散去...');

const world = {
  clock: { day: 21, hour: 12 },
  assets: { properties: [{ id: 'p1', name: '鑫雅阁', status: '已开张', incomePerDay: 45, placeId: 'project_1', rooms: { f1: { id: 'project_1__f1' } }, staffIds: [] }] },
  actors: {
    gongzi: { id: 'gongzi', name: '柳景行', role: '公子', location: 'street', home: 'street' },
  },
  places: {
    street: { id: 'street', name: '青石板长街' },
    project_1: { id: 'project_1', name: '鑫雅阁', exits: ['street'] },
    project_1__f1: { id: 'project_1__f1', name: '鑫雅阁·一层大堂', parent: 'project_1' },
  },
};

const n = runBusinessTraffic(world);
assert.ok(n >= 1, '应有客人进店');
assert.strictEqual(world.actors.gongzi.location, 'project_1__f1', '公子应进一层大堂');
assert.strictEqual(world.actors.gongzi.trafficPlace, 'project_1', '应记下进店产业');

world.clock.hour = 22;
runBusinessTraffic(world);
assert.strictEqual(world.actors.gongzi.location, 'street', '打烊应散回长街');
assert.ok(!world.actors.gongzi.trafficPlace, '进店标记应清掉');
console.log('✅ 开门进客、打烊散客');
