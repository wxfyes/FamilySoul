import { applyAction } from '../src/world/apply.js';
import { VERBS } from '../src/world/intent.js';
import { loadState } from '../src/world/state.js';

console.log('--- 测试 Apply 唯一结算器与幂等性 (真实 State 形状) ---');

// 加载真实数据
const baseWorld = loadState('data');
const mockWorld = JSON.parse(JSON.stringify(baseWorld));

mockWorld.actors.husband.location = 'husband_room';
mockWorld.actors.liuwenxia.location = 'husband_room';
mockWorld.assets.silver = 20;
mockWorld.pendingInvitation = { from: 'liuwenxia', toPlace: '城南小茶摊' };
const initialVersion = Number(mockWorld.version || 1);

const intent = {
  id: 'act_test_real_001',
  actor: 'husband',
  verb: VERBS.MOVE,
  target: '城南小茶摊',
  companions: [{ id: 'liuwenxia', name: '紫嫣' }],
};

const gate = {
  ok: true,
  context: {
    targetPlaceId: null, // 无已知地点，需即时造景
    isPrivateScene: false,
    cost: { silver: 0 },
    companionsOk: true,
  },
};

// 1. 第一次执行
console.log('--- 第一次执行 ---');
const res1 = applyAction({ world: mockWorld, intent, verdict: { companionConsented: true }, gate });
if (!res1.applied) throw new Error('第一次结算应成功');

// 校验相公与伴侣坐标
const newLoc = mockWorld.actors.husband.location;
if (!newLoc || !newLoc.startsWith('place_')) throw new Error('相公未生成合法新场景 ID: ' + newLoc);
if (mockWorld.actors.liuwenxia.location !== newLoc) throw new Error('伴侣坐标未与相公同步');
if (!mockWorld.places[newLoc] || mockWorld.places[newLoc].name !== '城南小茶摊') throw new Error('新场景城南小茶摊未入册');
if (mockWorld.pendingInvitation) throw new Error('待确认邀约未清空');
if (mockWorld.version !== initialVersion + 1) throw new Error('版本号应递增');

console.log('第一次执行完全符合真实预期！');

// 2. 第二次执行（重放验证幂等）
console.log('--- 第二次重放 (幂等验证) ---');
const res2 = applyAction({ world: mockWorld, intent, verdict: { companionConsented: true }, gate });
if (res2.applied || !res2.skipped) throw new Error('第二次重放应被幂等拦截');
if (mockWorld.version !== initialVersion + 1) throw new Error('重放时不应重复递增版本号');

// 3. 第三次执行（再重放验证幂等）
console.log('--- 第三次重放 (幂等验证) ---');
const res3 = applyAction({ world: mockWorld, intent, verdict: { companionConsented: true }, gate });
if (res3.applied || !res3.skipped) throw new Error('第三次重放应被幂等拦截');
if (mockWorld.version !== initialVersion + 1) throw new Error('重放时不应重复递增版本号');

console.log('🎉 幂等性校验通过：同 actionId 执行 3 次，状态只变 1 次，版本号只增加 1 次！');

// 4. 客栈上房开房真实扣费（上房扣 3 两）
const roomIntent = {
  id: 'act_room_real_002',
  actor: 'husband',
  verb: VERBS.MOVE,
  target: '临江客栈·天字上房',
  companions: [{ id: 'liuwenxia', name: '紫嫣' }],
};
const roomGate = {
  ok: true,
  context: {
    targetPlaceId: null,
    isPrivateScene: true,
    cost: { silver: 3 }, // 上房 3 两
    companionsOk: true,
  },
};
const resRoom = applyAction({ world: mockWorld, intent: roomIntent, verdict: { companionConsented: true }, gate: roomGate });
if (mockWorld.assets.silver !== 17) throw new Error('真实上房扣费 3 两未生效，当前银两: ' + mockWorld.assets.silver);
if (mockWorld.version !== initialVersion + 2) throw new Error('开房后版本号应递增');

console.log('🎉 Apply 结算器基于真实 State 形状的测试 100% 通过！');
