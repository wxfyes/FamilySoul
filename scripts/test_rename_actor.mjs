import assert from 'node:assert';
import { renameActor } from '../src/world/identity.js';

console.log('🧪 改名只改当前名与活约定，历史旧事保留原话...');

const world = {
  clock: { day: 20, hour: 15 },
  actors: { yangcaiyun: { id: 'yangcaiyun', name: '杨采云' } },
  promises: [
    { text: '明日去杨采云处对账', done: false },
    { text: '杨采云已还清旧账', done: true },
  ],
  tasks: [{ actorId: 'yangcaiyun', name: '杨采云', what: '对账' }],
  quotes: [],
  assets: { properties: [{ keeper: 'yangcaiyun', keeperName: '杨采云' }] },
  notes: [],
};

const r = renameActor(world, 'yangcaiyun', '柳如烟');
assert.strictEqual(r.ok, true);
assert.strictEqual(world.actors.yangcaiyun.name, '柳如烟');
assert.strictEqual(world.tasks[0].name, '柳如烟');
assert.strictEqual(world.assets.properties[0].keeperName, '柳如烟');
assert.strictEqual(world.promises[0].text, '明日去柳如烟处对账', '活约定应跟新名');
assert.strictEqual(world.promises[1].text, '杨采云已还清旧账', '已了结的旧事保留原话');
console.log('✅ 当前名/活约定/差事/产业已改，历史旧事未动');
