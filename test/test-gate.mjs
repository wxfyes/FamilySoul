import { checkGate, getPlaceDisplayName } from '../src/world/gate.js';
import { VERBS } from '../src/world/intent.js';
import { loadState } from '../src/world/state.js';

console.log('--- 测试 Gate 合法性门禁 (真实 State 形状) ---');

// 1. 加载真实底模
const baseWorld = loadState('data');

// 构造测试夹具：相公在正房(husband_room)，紫嫣在正房，沈婉儿在后院暖阁(backyard)
const trueWorld = JSON.parse(JSON.stringify(baseWorld));
trueWorld.actors.husband.location = 'husband_room';
trueWorld.actors.liuwenxia.location = 'husband_room';
trueWorld.actors.waner.location = 'backyard';
trueWorld.assets.silver = 0.5; // 故意设低银两用于测试盘缠

console.log('相公位置:', getPlaceDisplayName(trueWorld, trueWorld.actors.husband.location));
console.log('紫嫣位置:', getPlaceDisplayName(trueWorld, trueWorld.actors.liuwenxia.location));
console.log('婉儿位置:', getPlaceDisplayName(trueWorld, trueWorld.actors.waner.location));

// 【真实测试 1A】：同宅汇合（相公在正房，婉儿在后院暖阁，带婉儿启程通过）
const intent1A = {
  actor: 'husband',
  verb: VERBS.MOVE,
  target: '回春堂药铺',
  companions: [{ id: 'waner', name: '沈婉儿' }],
};
const gate1A = checkGate(trueWorld, intent1A);
console.log('测试 1A (同宅内院汇合放行): ok =', gate1A.ok, 'companionsStatus =', gate1A.companionsStatus[0]);
if (gate1A.companionsStatus[0].ok !== true) {
  throw new Error('测试 1A 失败：同宅内院应当放行汇合');
}

// 【真实测试 1B】：异地不在场阻断（婉儿远在回春堂药铺 pharmacy，相公在正房带婉儿去客栈）
trueWorld.actors.waner.location = 'pharmacy';
const gate1B = checkGate(trueWorld, intent1A);
console.log('测试 1B (异地不在场真实阻断): ok =', gate1B.ok, 'reasons =', gate1B.reasons[0]);
if (!gate1B.reasons[0].includes('回春堂药铺')) {
  throw new Error('测试 1B 失败：未能通过真实 location pharmacy 识别出回春堂药铺不在场');
}
trueWorld.actors.waner.location = 'backyard'; // 复原

// 【真实测试 2】：真实 relations[husband].grievance 怨气拦截
trueWorld.actors.liuwenxia.relations.husband.grievance = 50; // 设高怨气
const intent2 = {
  actor: 'husband',
  verb: VERBS.MOVE,
  target: '回春堂药铺',
  companions: [{ id: 'liuwenxia', name: '紫嫣' }],
};
const gate2 = checkGate(trueWorld, intent2);
console.log('测试 2 (伴侣真实怨气阻断): status =', gate2.companionsStatus[0]);
if (gate2.companionsStatus[0].ok !== false || !gate2.companionsStatus[0].reason.includes('怨气值50')) {
  throw new Error('测试 2 失败：未能从真实 relations.husband.grievance 读到怨气值');
}
trueWorld.actors.liuwenxia.relations.husband.grievance = 0; // 复原

// 【真实测试 3】：真实 activity.text 繁忙拦截
trueWorld.actors.liuwenxia.activity = { text: '正核账核对昨日茶酒流水', at: 10, day: 1 };
const gate3 = checkGate(trueWorld, intent2);
console.log('测试 3 (伴侣真实 activity 差事阻断): status =', gate3.companionsStatus[0]);
if (gate3.companionsStatus[0].ok !== false || !gate3.companionsStatus[0].reason.includes('核账')) {
  throw new Error('测试 3 失败：未能从真实 activity.text 读到差事');
}
trueWorld.actors.liuwenxia.activity = undefined; // 复原

// 【真实测试 4】：真实盘缠与上房价格（上房3两，手头仅0.5两）
const intent4 = {
  actor: 'husband',
  verb: VERBS.MOVE,
  target: '临江客栈·天字上房',
  companions: [{ id: 'liuwenxia', name: '紫嫣' }],
};
const gate4 = checkGate(trueWorld, intent4);
console.log('测试 4 (客栈上房真实价格门禁): ok =', gate4.ok, 'reasons =', gate4.reasons[0]);
if (gate4.ok !== false || !gate4.reasons[0].includes('上房需银三两')) {
  throw new Error('测试 4 失败：开房真实价格需为 3 两');
}

// 【真实测试 5】：风流亲密云雨不硬阻断（尊重相公快活体验，blocked 必须为 false）
trueWorld.actors.husband.location = 'street';
trueWorld.actors.liuwenxia.location = 'street';
const intent5 = {
  actor: 'husband',
  verb: VERBS.INTIMATE,
  companions: [{ id: 'liuwenxia', name: '紫嫣' }],
};
const gate5 = checkGate(trueWorld, intent5);
console.log('测试 5 (风流亲密不硬阻断): blocked =', gate5.blocked, 'reasons =', gate5.reasons[0]);
if (gate5.blocked === true) {
  throw new Error('测试 5 失败：亲密绝不可搞代码级硬阻断！');
}

console.log('🎉 Gate 基于真实 State 形状的所有测试 100% 通过！');
