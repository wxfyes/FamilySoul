import assert from 'node:assert/strict';
import { parseDismissIntent, isMassDismiss, homeRoomForName, parseSummonTarget } from '../src/chat/intent-pipeline.js';

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

  // 代词"她/他/它"绝不能被当成人名
  const r6 = parseDismissIntent('她怎么还不走？');
  assert.equal(r6.isDismiss, true);
  assert.equal(r6.targetName, null, '她 是代词，不是人名');

  // 名字里含"全/都/各"的正常人名不能被误杀
  const r7 = parseDismissIntent('全叔回房');
  assert.equal(r7.targetName, '全叔', '全叔 是正常人名，不能被当成群体词');

  // 群体称呼仍必须清洗
  const r8 = parseDismissIntent('都给我退下');
  assert.equal(r8.targetName, null);
  assert.equal(isMassDismiss('都给我退下'), true);

  // 议事厅对家丁护院说"各自散了"：必须全员清场，不能当人名
  const r9 = parseDismissIntent('让他们各自散了');
  assert.equal(r9.isDismiss, true, '让他们各自散了 应识别为离场');
  assert.equal(r9.targetName, null, '各自 不是人名');
  assert.equal(isMassDismiss('让他们各自散了'), true);

  const r10 = parseDismissIntent('家丁护院都散了吧');
  assert.equal(r10.isDismiss, true, '家丁护院都散了吧 应识别为离场');
  assert.equal(r10.targetName, null);

  // 实测 bug：把"都散了，"当成姓名，导致走了"点名"分支，全员清场失效
  const r11 = parseDismissIntent('各自都散了，去忙你们的事情吧');
  assert.equal(r11.isDismiss, true);
  assert.equal(r11.targetName, null, '都散了 不是人名');
  assert.equal(isMassDismiss('各自都散了，去忙你们的事情吧'), true);
}

// 2. 内眷住处规制映射回归
{
  assert.equal(homeRoomForName('崔婉宁'), 'wang_mansion_east', '婉宁住东厢');
  assert.equal(homeRoomForName('林芸娘'), 'wang_mansion_west', '芸娘住西厢');
  assert.equal(homeRoomForName('沈婉儿'), 'husband_room', '婉儿正妻归宿为正房');
  
  // 小翠绝对不允许映射到正房 husband_room
  const cuiRoom = homeRoomForName('小翠', { hasServantRoom: false });
  assert.notEqual(cuiRoom, 'husband_room', '小翠绝对不能住在正房主卧');
  assert.equal(cuiRoom, 'wang_mansion_west', '无专用仆房时小翠去西厢');

  const cuiRoomWithHouzhao = homeRoomForName('小翠', { places: { 'place_houzhao': { name: '临江·王宅·后罩房' } } });
  assert.equal(cuiRoomWithHouzhao, 'place_houzhao', '有后罩房时小翠去后罩房');

  // 别家的下房绝不能收留王宅丫鬟
  const cuiRoomOtherMansion = homeRoomForName('小翠', {
    places: { 'cui_mansion__servant': { name: '崔府·下房' } },
  });
  assert.equal(cuiRoomOtherMansion, 'wang_mansion_west', '别家下房不算，小翠回西厢');

  // 3. 当差下人（家丁/护院）归宿规制：退场回归外院门房大门，绝不许进正房内室或留在议事厅
  const guardRoom = homeRoomForName('常木', {
    role: '家丁',
    places: {
      'husband_room': { name: '临江·王宅·正房' },
      'place_62': { name: '临江·王宅·议事厅' },
      'husband_room__gate': { name: '临江·王宅·朱漆大门' },
    },
  });
  assert.equal(guardRoom, 'husband_room__gate', '家丁退场必须回归外院大门/门房当差');
  assert.notEqual(guardRoom, 'husband_room', '家丁绝不许进正房内室');
  assert.notEqual(guardRoom, 'place_62', '家丁退场绝不许死锁在议事厅');
  // 实测 bug：把"进来两个护院"误当传唤"进"，导致把临江客栈掌柜孙进抓来
  assert.equal(parseSummonTarget('进来两个护院'), null, '进来两个护院绝不能解析为人名');
  assert.equal(parseSummonTarget('叫两个家丁进来'), null);
  assert.equal(parseSummonTarget('唤芸娘过来'), '芸娘');
  assert.equal(parseSummonTarget('让小翠到跟前来'), '小翠');
}

console.log('✅ 所有送客/回房意图解析与内眷规制测试全部通过！');

