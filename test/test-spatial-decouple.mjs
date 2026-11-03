import assert from 'assert';
import { applySummon } from '../src/world/summon.js';
import { normalizeMemberReply } from '../src/world/member-reply.js';
import { loadState, saveState, ensureCourt } from '../src/world/state.js';
import fs from 'fs';
import path from 'path';

console.log('=== 开始物理空间解耦与寻人定位回归验证 ===');

const tmpDir = path.resolve('data/test-spatial-decouple');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const worldDir = path.join(tmpDir, 'world');
if (!fs.existsSync(worldDir)) fs.mkdirSync(worldDir, { recursive: true });

// 初始化一份世界数据：相公在正房，婉儿在后院，紫嫣在于家酒肆
const baseWorld = {
  stateVersion: 4,
  version: 4,
  clock: { day: 15, hour: 22 },
  places: {
    husband_room: { name: '正房', exits: ['backyard', 'tea_house'], owner: 'husband' },
    backyard: { name: '后院暖阁', exits: ['husband_room', 'tea_house'], owner: 'husband' },
    tea_house: { name: '临江茶坊', exits: ['husband_room', 'backyard', 'street'], owner: 'husband' },
    wine_shop: { name: '于家酒肆', exits: ['street'], owner: 'liuwenxia' },
    street: { name: '长街', exits: ['tea_house', 'wine_shop'] },
  },
  actors: {
    husband: { id: 'husband', name: '王甯', location: 'husband_room' },
    waner: { id: 'waner', name: '沈婉儿', location: 'backyard', household: true },
    liuwenxia: { id: 'liuwenxia', name: '紫嫣', location: 'wine_shop', home: 'wine_shop' },
  },
};
saveState(tmpDir, baseWorld);

// 测试 1：紫嫣去找王甯（相公在私宅正房）
const res = applySummon(tmpDir, '噢，去找王甯', null, 'liuwenxia');
const w1 = loadState(tmpDir);

console.log('紫嫣找相公后位置：', w1.actors.liuwenxia.location);
console.log('相公闻讯后位置：', w1.actors.husband.location);

assert.strictEqual(w1.actors.liuwenxia.location, 'tea_house', '外妇紫嫣绝不能私闯正房寝居，只能止步于临江茶坊前堂！');
assert.strictEqual(w1.actors.husband.location, 'tea_house', '相公闻讯移步到临江茶坊前堂与紫嫣相见！');
assert.notStrictEqual(w1.actors.waner.location, 'tea_house', '沈婉儿仍在后院，绝不在茶坊！');
console.log('✅ 测试 1 通过：外妇找相公物理止步于茶坊前堂，绝不瞬移正房');

// 测试 2：模型未加标签的对白在紫嫣视角下
const rawAiReply = '（轻抚紫嫣的手）叫娘子如何？只是眼下怕要耽搁些时日了，吏部那边传话要我立刻去回话...';
const normalized = normalizeMemberReply(rawAiReply, {
  selfName: '紫嫣',
  selfAliases: ['紫嫣', '刘文霞'],
  present: ['王甯'],
  husbandPresent: true,
  placeName: '临江茶坊',
});

console.log('规范化后结果：', normalized);
assert.ok(normalized.startsWith('【王甯】：'), '王甯在场时未打标签的回复必须归属于王甯！');
assert.ok(!normalized.includes('沈婉儿'), '绝对严禁冒出沈婉儿！');
console.log('✅ 测试 2 通过：相公在场时未标说话人的台词精准归属于【王甯】');

// 测试 3：老存档如果紫嫣误留在正房，ensureCourt 自动自愈归位
const corruptedWorld = JSON.parse(JSON.stringify(baseWorld));
corruptedWorld.actors.liuwenxia.location = 'husband_room';
ensureCourt(corruptedWorld);
assert.strictEqual(corruptedWorld.actors.liuwenxia.location, 'wine_shop', '老存档误留在正房的外妇必须自愈归位回于家酒肆');
console.log('✅ 测试 3 通过：老存档滞留正房的外人自动自愈归位');

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('🎉 所有物理空间解耦测试全部通过！');
