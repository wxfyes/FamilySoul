import assert from 'node:assert/strict';
import { resolveTurnTarget, actorSeniority } from '../src/world/turn-target.js';
import { applyChatActions } from '../src/world/chat-actions.js';

console.log('🧪 运行护院传唤、领头人回话与主仆礼法单元回归测试...');

// 1. actorSeniority 排序测试
const roshu = { id: 'roshu', name: '罗叔', role: '护院', age: 45 };
const fusheng = { id: 'fusheng', name: '傅生', role: '护院', age: 22 };
const waner = { id: 'waner', name: '沈婉儿', role: '正妻' };
const changmu = { id: 'changmu', name: '常木', role: '家丁', age: 25 };

assert(actorSeniority(waner) > actorSeniority(roshu), '正妻位次高于护院头领');
assert(actorSeniority(roshu) > actorSeniority(fusheng), '罗叔(长者头领)位次高于傅生(跟班)');
assert(actorSeniority(fusheng) > actorSeniority(changmu), '护院位次高于普通家丁');

// 2. 指名领头的回话
const fakeWorld = {
  chatPartners: { husband: 'fusheng' }, // 上一轮傅生说了话
  actors: { roshu, fusheng, waner },
};

const turn1 = resolveTurnTarget({
  world: fakeWorld,
  viewerId: 'husband',
  say: '以后你们领头的回话',
  present: [roshu, fusheng],
});
assert.equal(turn1.actorId, 'roshu', '相公说领头的回话时，必须锁定罗叔');

// 3. 随从傅生曾开腔，但领头罗叔在场时，相公未指名问话，不得继续让小跟班霸占麦克风
const turn2 = resolveTurnTarget({
  world: fakeWorld,
  viewerId: 'husband',
  say: '今晚府里加几道岗？',
  present: [roshu, fusheng],
});
assert.equal(turn2.actorId, 'roshu', '领头罗叔在场时，小跟班不得僭越，首位正主必须是罗叔');

// 4. applyChatActions "进来2个护院" 物理移动与领头人前置测试
const worldWithGate = {
  places: {
    husband_room__gate: { name: '临江·王宅·朱漆大门' },
    place_62: { name: '临江·王宅·议事厅' },
  },
  actors: {
    husband: { id: 'husband', name: '王甯', location: 'place_62' },
    fusheng: { id: 'fusheng', name: '傅生', role: '护院', location: 'husband_room__gate', age: 22 },
    roshu: { id: 'roshu', name: '罗叔', role: '护院', location: 'husband_room__gate', age: 45 },
    shenggē: { id: 'shenggē', name: '盛哥', role: '护院', location: 'husband_room__gate', age: 26 },
  },
};

const notices = applyChatActions({
  world: worldWithGate,
  viewerId: 'husband',
  sayText: '进来2个护院',
});

assert(notices.length > 0, '必须产生进门提示');
assert(notices[0].includes('罗叔、盛哥'), '领头人罗叔与年长护院盛哥必须优先传唤进屋');
assert.equal(worldWithGate.actors.roshu.location, 'place_62', '罗叔成功进入议事厅');
assert.equal(worldWithGate.actors.shenggē.location, 'place_62', '盛哥成功进入议事厅');
assert.equal(worldWithGate.actors.fusheng.location, 'husband_room__gate', '年纪最轻的护院傅生留在大门');

console.log('✅ 所有护院传唤、领头人回话与主仆礼法单元回归测试全部通过！');
