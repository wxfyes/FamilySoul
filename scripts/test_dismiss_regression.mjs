import assert from 'node:assert/strict';
import { parseDismissIntent, isMassDismiss, homeRoomForName } from '../src/chat/intent-pipeline.js';

console.log('🧪 运行送客/回房意图解析与住处规制回归测试...');

// 1. 词法解析回归
{
  const r1 = parseDismissIntent('都各自回房间睡觉吧');
  assert.equal(r1.isDismiss, true, '应识别为离场意图');
  assert.equal(r1.targetName, null, '都各自 不应被当成人名');
  assert.equal(isMassDismiss('都各自回房间睡觉吧'), true, '应识别为全员清场');

  const r2 = parseDismissIntent('芸娘怎么还不走？');
  assert.equal(r2.isDismiss, true, '催促应识别为离场意图');
  assert.equal(r2.targetName, '芸娘', '应精准识别目标为芸娘');
  assert.equal(isMassDismiss('芸娘怎么还不走？'), false, '催促单人不是全员清场');

  const r3 = parseDismissIntent('小翠怎么还不走');
  assert.equal(r3.isDismiss, true);
  assert.equal(r3.targetName, '小翠');

  const r4 = parseDismissIntent('都走吧');
  assert.equal(r4.isDismiss, true);
  assert.equal(r4.targetName, null);
  assert.equal(isMassDismiss('都走吧'), true);

  const r5 = parseDismissIntent('还不走？');
  assert.equal(r5.isDismiss, true);
  assert.equal(r5.targetName, null);
}

// 2. 内眷住处规制映射回归
{
  assert.equal(homeRoomForName('崔婉宁'), 'wang_mansion_east', '婉宁住东厢');
  assert.equal(homeRoomForName('林芸娘'), 'wang_mansion_west', '芸娘住西厢');
  assert.equal(homeRoomForName('沈婉儿', { includeWife: false }), null, '全员送客时婉儿默认不映射外室');
  assert.equal(homeRoomForName('沈婉儿', { includeWife: true }), 'husband_room', '指名婉儿回房映射正房');
  
  // 小翠绝对不允许映射到正房 husband_room
  const cuiRoom = homeRoomForName('小翠', { hasServantRoom: false });
  assert.notEqual(cuiRoom, 'husband_room', '小翠绝对不能住在正房主卧');
  assert.equal(cuiRoom, 'wang_mansion_west', '无专用仆房时小翠去西厢');

  const cuiRoomWithHouzhao = homeRoomForName('小翠', { places: { 'place_houzhao': { name: '临江·王宅·后罩房' } } });
  assert.equal(cuiRoomWithHouzhao, 'place_houzhao', '有后罩房时小翠去后罩房');
}

console.log('✅ 所有送客/回房意图解析与内眷规制测试全部通过！');
