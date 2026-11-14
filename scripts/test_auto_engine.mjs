import assert from 'node:assert/strict';
import { autoResolveMatrimony, detectMatrimonyIntent } from '../src/world/auto-matrimony.js';
import { syncAutoChronicle } from '../src/world/auto-chronicle.js';
import { itemsOf } from '../src/world/items.js';

console.log('=== 开始执行全自动迎娶、名分确立与大事记自发流转断言 ===');

// 1. 意图识别测试
const intent1 = detectMatrimonyIntent('静儿，今日起我便纳你过门，做我王家侧室如夫人！');
assert.ok(intent1 && intent1.ok, '应识别出迎娶誓约');
assert.equal(intent1.targetName, '静儿');
assert.equal(intent1.rank, '侧室如夫人');

const intentNeg = detectMatrimonyIntent('我何时说要纳你了？别胡思乱想');
assert.equal(intentNeg, null, '否定疑问句绝不触发迎娶');

// 2. 全自动迎娶推演测试
const world = {
  clock: { day: 26, hour: 12 },
  actors: {
    husband: { id: 'husband', name: '王甯', location: 'wang_mansion__main_room' },
    zhanjing: { id: 'zhanjing', name: '静儿', location: 'wang_mansion__main_room', gender: 'female', relations: { husband: { trust: 85, favor: 90 } } },
  },
  places: {
    wang_mansion__main_room: { id: 'wang_mansion__main_room', name: '提督王府正房' },
  },
  items: [],
  milestones: [],
  court: { offices: {} },
};

const res = autoResolveMatrimony(world, { sayText: '静儿，今日起我便纳你为侧室，入我王家门！' });
assert.equal(res.triggered, true, '应成功触发全自动迎娶推演');
console.log('✓ 迎娶回执:', res.notice);

const jing = world.actors.zhanjing;
assert.equal(jing.spouse, 'husband', '配偶应全自动变更为 husband');
assert.equal(jing.household, true, '后宅归属应全自动变更为 true');
assert.ok(jing.role.includes('如夫人') || jing.role.includes('侧室'), '名分应全自动确立为侧室或如夫人');
assert.ok(itemsOf(world, 'husband').some((it) => it.name.includes('静儿') && it.name.includes('婚书')), '行囊中应全自动核发红绸婚书');
assert.ok(world.milestones.some((m) => m.includes('静儿') && m.includes('侧室')), '大事记中应全自动落账纳聘大事');

// 3. 全自动大事记中枢同步测试
const syncAdded = syncAutoChronicle(world);
console.log('✓ 自动同步大事记数量:', syncAdded.length);
assert.ok(world.milestones.length > 0, '大事记应有自发记录');

console.log('🎉 全自动纳妾迎娶、名分确立与大事记自发生长测试 100% 通过！');
