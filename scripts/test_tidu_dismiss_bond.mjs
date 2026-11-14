import assert from 'node:assert/strict';
import { getHusbandOfficialInfo } from '../src/world/items.js';
import { ensureCourtSystem } from '../src/world/court.js';
import { healWorld } from '../src/world/heal.js';
import { isMassDismiss } from '../src/chat/intent-pipeline.js';
import { applyChatActions } from '../src/world/chat-actions.js';

console.log('=== 开始执行提督官职、退兵保护、记忆去重与关系网全量断言 ===');

// 1. 验证相公提督官职与大事记
const mockWorld = {
  clock: { day: 26, hour: 10 },
  actors: {
    husband: {
      id: 'husband',
      name: '王甯',
      city: '京城',
      location: 'capital_mansion__main',
      role: '江南水陆提督总兵官·临江王氏家主',
    },
    shenwaner: {
      id: 'shenwaner',
      name: '沈婉儿',
      city: '京城',
      location: 'capital_mansion__main',
      role: '正妻·一品诰命夫人',
      spouse: 'husband',
      household: true,
      memories: [
        '【举家随行·迁往京师】：相公下令全家随行…',
        '【举家随行·迁往京师】：相公下令全家随行…', // 重复
      ],
    },
    zhanjing: {
      id: 'zhanjing',
      name: '静儿',
      city: '京城',
      location: 'capital_mansion__main',
      role: '自立娘子·掌账主簿',
      relations: { husband: { trust: 90, favor: 88 } },
    },
    general_zhaolei: {
      id: 'general_zhaolei',
      name: '赵雷',
      city: '京城',
      location: 'capital_mansion__main',
      role: '游击将军兼亲卫统领',
      relations: { husband: { loyalty: 99, favor: 95 } },
    },
  },
  places: {
    capital_mansion__main: { id: 'capital_mansion__main', name: '京师·提督王府·正殿暖阁', guardsPresent: true },
    capital_mansion__barracks: { id: 'capital_mansion__barracks', name: '京师·提督王府·亲兵营值房' },
  },
  memories: [
    { text: '【举家随行·迁往京师】：相公下令全家随行，自临江启程迁驻京师提督王府正殿' },
    { text: '【举家随行·迁往京师】：相公下令全家随行，自临江启程迁驻京师提督王府正殿' }, // 重复
    { text: '相公全资盘下运河大酒楼，盛大开业日进斗金' },
  ],
  court: { offices: {} },
  milestones: [],
};

// 验证 ensureCourtSystem 初始化提督
ensureCourtSystem(mockWorld);
assert.equal(mockWorld.court.offices.tiduzongbing.holder, 'husband', '提督 holder 应为 husband');

const offInfo = getHusbandOfficialInfo(mockWorld);
console.log('✓ 官职信息:', offInfo.fullTitle, offInfo.shortCall);
assert.equal(offInfo.hasOffice, true);
assert.equal(offInfo.rank, '从一品');
assert.equal(offInfo.shortCall, '大帅');
assert.ok(offInfo.highestTitle.includes('水陆提督'));

// 2. 验证 healWorld 记忆去重与大事记补录
healWorld(mockWorld);
console.log('✓ 经过 healWorld 后的 memories 数量:', mockWorld.memories.length);
console.log('✓ memories 内容:', mockWorld.memories.map((m) => m.text));
const uniqueTexts = new Set(mockWorld.memories.map((m) => String(m.text || '').slice(0, 20)));
assert.equal(uniqueTexts.size, mockWorld.memories.length, '世界记忆中不应存在前20字符重复的记忆');
assert.equal(mockWorld.actors.shenwaner.memories.length, 1, '婉儿的重复进京记忆应被去重');
assert.ok(mockWorld.milestones.some((m) => m.includes('江南水陆提督总兵官')), '大事记必须包含从一品水陆提督');

// 3. 验证“退下”指令：亲兵退到外院，沈婉儿和静儿绝对不退
const chatRes = applyChatActions({ world: mockWorld, sayText: '好，退出去吧' });
console.log('✓ chatRes notice:', chatRes.notice);
assert.ok(mockWorld.flags?.guardsDismissedThisTurn, '应标记 guardsDismissedThisTurn 为 true');
assert.equal(mockWorld.actors.general_zhaolei.location, 'capital_mansion__barracks', '赵雷应退回外院值房');
assert.equal(mockWorld.actors.shenwaner.location, 'capital_mansion__main', '沈婉儿必须留在正殿');
assert.equal(mockWorld.actors.zhanjing.location, 'capital_mansion__main', '静儿必须留在正殿');

console.log('🎉 全部提督官职、大事记、退下防线与去重断言 100% 通过！');
