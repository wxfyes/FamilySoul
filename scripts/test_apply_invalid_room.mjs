import assert from 'node:assert';
import { applyAction } from '../src/world/apply.js';

console.log('🧪 前往未展开的宅门/雅间，落点必须真实存在...');

const world = {
  clock: { day: 20, hour: 15 },
  assets: { silver: 0 },
  flags: {},
  actors: {
    husband: { id: 'husband', name: '王甯', location: 'street', home: 'street' },
    luyu: { id: 'luyu', name: '陆羽', location: 'house', home: 'house' },
  },
  places: {
    street: { id: 'street', name: '青石板长街', exits: [] },
    house: {
      id: 'house', name: '陆羽的小院', residence: true, owner: 'luyu',
      exits: ['street'],
      rooms: { gate: { id: 'house__gate', name: '大门', use: 'gate' } },
    },
  },
};

const intent = { id: 't1', actor: 'husband', verb: 'MOVE', target: 'house__gate', companions: [], params: {} };
applyAction({ dataDir: null, world, intent, verdict: {} });
const loc = String(world.actors.husband.location);
assert.ok(world.places[loc], '最终落点必须是 world.places 里真实存在的地点，实际：' + loc);
assert.ok(loc === 'house__gate' || loc === 'house', '应落到大门或宅院，实际：' + loc);
console.log('✅ 落点真实存在：' + loc);
