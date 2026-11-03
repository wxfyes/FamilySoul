/**
 * 同行邀约与转场机制 (五大缺口及流程图分支) 全景回归测试
 */
import assert from 'assert';
import { parseIntent, VERBS } from '../src/world/intent.js';
import { checkGate } from '../src/world/gate.js';
import { applyAction } from '../src/world/apply.js';

console.log('--- 测试 同行邀约与转场机制流程图 (5大缺口闭环) ---');

// 真实世界的基准 State
function createBaseWorld() {
  return {
    version: 1,
    clock: { day: 1, hour: 10 },
    assets: { silver: 20 },
    actors: {
      husband: { id: 'husband', name: '王甯', location: 'husband_room' },
      liuwenxia: {
        id: 'liuwenxia',
        name: '紫嫣',
        location: 'husband_room',
        home: 'place_jiusi',
        relations: { husband: { trust: 80, desire: 50, grievance: 0 } },
        activity: { text: '闲坐沏茶' },
      },
      waner: {
        id: 'waner',
        name: '沈婉儿',
        location: 'clinic', // 沈婉儿在医馆，不在身边
        home: 'husband_room',
        relations: { husband: { trust: 90, grievance: 0 } },
      },
      busy_npc: {
        id: 'busy_npc',
        name: '小翠',
        location: 'husband_room',
        relations: { husband: { trust: 50, grievance: 0 } },
        activity: { text: '正核账核对流水' },
      },
    },
    places: {
      husband_room: { id: 'husband_room', name: '正房' },
      clinic: { id: 'clinic', name: '回春堂药铺' },
      tea_stall: { id: 'tea_stall', name: '城南小茶摊' },
    },
    pendingInvitation: null,
  };
}

// ==========================================
// 缺口①：在场判定前置
// ==========================================
{
  const world = createBaseWorld();
  // 相公提议带沈婉儿去小茶摊，但沈婉儿此刻在医馆 (异地)
  const intent = parseIntent({
    text: '婉儿，咱们去城南小茶摊坐坐',
    actorId: 'husband',
    world,
  });
  assert.strictEqual(intent.verb, VERBS.MOVE);
  assert.strictEqual(intent.target, '城南小茶摊');
  assert.strictEqual(intent.companions.length, 1);
  assert.strictEqual(intent.companions[0].id, 'waner');

  const gate = checkGate(world, intent);
  const wanerSt = gate.companionsStatus.find((s) => s.id === 'waner');
  assert.strictEqual(wanerSt.ok, false);
  assert.strictEqual(wanerSt.notPresent, true);
  assert.match(wanerSt.reason, /回春堂药铺/);
  console.log('✅ 缺口① 在场判定前置校验通过：不在场者被明确拦截 (notPresent=true)');
}

// ==========================================
// 缺口②：待确认邀约的消费与清空 (双方共识即时转场 vs 拒绝清空)
// ==========================================
{
  // 分支 A: 对方已提前邀约 ➔ 相公答"走吧" ➔ 双方共识达成，消费并清空邀约，双人转场
  const worldA = createBaseWorld();
  worldA.pendingInvitation = {
    from: 'liuwenxia',
    to: 'husband',
    target: '城南小茶摊',
    day: 1,
  };

  const intentA = parseIntent({
    text: '好啊，走吧',
    actorId: 'husband',
    world: worldA,
  });
  assert.strictEqual(intentA.verb, VERBS.MOVE);
  assert.strictEqual(intentA.target, '城南小茶摊');
  assert.strictEqual(intentA.params.isConsensus, true);
  assert.strictEqual(intentA.companions.some((c) => c.id === 'liuwenxia'), true);

  const gateA = checkGate(worldA, intentA);
  assert.strictEqual(gateA.companionsStatus[0].consensus, true);

  const applyResA = applyAction({
    dataDir: 'fakeDir',
    world: worldA,
    intent: intentA,
    verdict: { companionConsented: true },
    gate: gateA,
  });
  assert.strictEqual(applyResA.applied, true);
  assert.strictEqual(worldA.pendingInvitation, undefined); // 消费并清空！
  assert.strictEqual(worldA.actors.husband.location, 'tea_stall');
  assert.strictEqual(worldA.actors.liuwenxia.location, 'tea_stall'); // 双人同步转场！
  console.log('✅ 缺口② 分支A 邀约达成共识：消费清空邀约 + 双方同步位移');

  // 分支 B: 对方已提前邀约 ➔ 相公答"不去/算了" ➔ 清空邀约，不造景，两人留在原地
  const worldB = createBaseWorld();
  worldB.pendingInvitation = {
    from: 'liuwenxia',
    to: 'husband',
    target: '城南小茶摊',
    day: 1,
  };
  const intentB = parseIntent({
    text: '我手头有事，不去了，改天吧',
    actorId: 'husband',
    world: worldB,
  });
  assert.strictEqual(intentB.params.rejectPending, true);
  const applyResB = applyAction({
    dataDir: 'fakeDir',
    world: worldB,
    intent: intentB,
  });
  assert.strictEqual(worldB.pendingInvitation, undefined); // 拒绝后即时清空！
  assert.strictEqual(worldB.actors.husband.location, 'husband_room'); // 两人留在原地
  assert.strictEqual(worldB.actors.liuwenxia.location, 'husband_room');
  console.log('✅ 缺口② 分支B 邀约拒绝：清空邀约，留在原地不造景');
}

// ==========================================
// 缺口③：拒绝要有理由 (手上有事/怨气)
// ==========================================
{
  const world = createBaseWorld();
  const intent = parseIntent({
    text: '小翠，陪我去城南小茶摊',
    actorId: 'husband',
    world,
  });
  const gate = checkGate(world, intent);
  const cuiSt = gate.companionsStatus.find((s) => s.id === 'busy_npc');
  assert.strictEqual(cuiSt.ok, false);
  assert.match(cuiSt.reason, /手头有差事【正核账核对流水】未了/);
  console.log('✅ 缺口③ 拒绝理由从真实账本出 (activity.text) 校验通过');
}

// ==========================================
// 缺口④：“她带你走”的反向同步
// ==========================================
{
  const world = createBaseWorld();
  // 紫嫣说："相公快随我去回春堂药铺"
  const intent = parseIntent({
    text: '相公，快随我去回春堂药铺',
    actorId: 'liuwenxia',
    world,
  });
  assert.strictEqual(intent.verb, VERBS.MOVE);
  assert.strictEqual(intent.target, '回春堂药铺');
  assert.strictEqual(intent.actor, 'liuwenxia');
  assert.strictEqual(intent.companions.some((c) => c.id === 'husband'), true);

  const gate = checkGate(world, intent);
  const applyRes = applyAction({
    dataDir: 'fakeDir',
    world,
    intent,
    verdict: { companionConsented: true },
    gate,
  });
  assert.strictEqual(applyRes.applied, true);
  assert.strictEqual(world.actors.liuwenxia.location, 'clinic');
  assert.strictEqual(world.actors.husband.location, 'clinic'); // 相公被带走，双人同移！
  console.log('✅ 缺口④ “她带你走”反向同步双人位移校验通过');
}

// ==========================================
// 缺口⑤：相公单方面邀请 ➔ 伴侣婉拒留守原地 (推拉剧情)
// ==========================================
{
  const world = createBaseWorld();
  const intent = parseIntent({
    text: '紫嫣，咱们去城南小茶摊坐坐',
    actorId: 'husband',
    world,
  });
  const gate = checkGate(world, intent);
  // 天道裁定伴侣拒绝同行 (留守原地)
  const applyRes = applyAction({
    dataDir: 'fakeDir',
    world,
    intent,
    verdict: { companionConsented: false },
    gate,
  });
  assert.strictEqual(applyRes.applied, true);
  assert.strictEqual(world.actors.husband.location, 'tea_stall'); // 相公去新地点
  assert.strictEqual(world.actors.liuwenxia.location, 'husband_room'); // 紫嫣仍在原处推拉
  console.log('✅ 缺口⑤ 天道裁定NPC拒绝：NPC留在原地产生推拉剧情校验通过');
}

// ==========================================
// 队伍 Party 四大核心验收标准测试 (持久伴随、跨轮跟随、脱队、独立脱队)
// ==========================================
{
  const world = createBaseWorld();
  world.places.inn = { id: 'inn', name: '临江客栈' };
  world.places.street = { id: 'street', name: '青石板长街' };
  world.places.wine_shop = { id: 'wine_shop', name: '于家酒肆' };

  // ① 验收一：带紫嫣去客栈 → 她在客栈，并入队 world.party.husband
  const intent1 = parseIntent({
    text: '带紫嫣去客栈',
    actorId: 'husband',
    world,
  });
  assert.strictEqual(intent1.verb, VERBS.MOVE);
  assert.strictEqual(intent1.companions.some(c => c.id === 'liuwenxia'), true);
  const gate1 = checkGate(world, intent1);
  applyAction({ dataDir: 'fakeDir', world, intent: intent1, verdict: { companionConsented: true }, gate: gate1 });
  
  assert.strictEqual(world.actors.husband.location, 'inn');
  assert.strictEqual(world.actors.liuwenxia.location, 'inn');
  assert.strictEqual(Array.isArray(world.party?.husband), true);
  assert.strictEqual(world.party.husband.includes('liuwenxia'), true);
  console.log('✅ ① 验收通过：带紫嫣去客栈 → 两人到达客栈，紫嫣成功入队 world.party.husband');

  // ② 验收二：再说「去长街」→ 她还跟着（核心验收点！无需再点名，自动跟随）
  const intent2 = parseIntent({
    text: '去长街',
    actorId: 'husband',
    world,
  });
  assert.strictEqual(intent2.verb, VERBS.MOVE);
  // 核心断言：即使没提紫嫣，companions 里自动带上队伍成员！
  assert.strictEqual(intent2.companions.some(c => c.id === 'liuwenxia'), true);
  const gate2 = checkGate(world, intent2);
  applyAction({ dataDir: 'fakeDir', world, intent: intent2, verdict: { companionConsented: true }, gate: gate2 });
  
  assert.strictEqual(world.actors.husband.location, 'street');
  assert.strictEqual(world.actors.liuwenxia.location, 'street');
  assert.strictEqual(world.party.husband.includes('liuwenxia'), true);
  console.log('✅ ② 验收通过：未点名说「去长街」→ 紫嫣自动持续跟随到达长街！');

  // ③ 验收三：说「你先回酒肆」→ 她脱队，之后相公再走不再跟着
  const intent3 = parseIntent({
    text: '紫嫣你先回酒肆，我办点事',
    actorId: 'husband',
    world,
  });
  const gate3 = checkGate(world, intent3);
  applyAction({ dataDir: 'fakeDir', world, intent: intent3, gate: gate3 });
  assert.strictEqual(world.party.husband.includes('liuwenxia'), false);

  // 相公再去客栈，紫嫣绝不再跟着
  const intent3b = parseIntent({
    text: '去客栈',
    actorId: 'husband',
    world,
  });
  assert.strictEqual(intent3b.companions.some(c => c.id === 'liuwenxia'), false);
  console.log('✅ ③ 验收通过：说「你先回酒肆」→ 成功脱队，后续相公位移不再跟随');

  // ④ 验收四：她在自己账号走 → 自动脱队，相公绝不被拽
  // 重新将紫嫣拉入队伍
  world.actors.husband.location = 'street';
  world.actors.liuwenxia.location = 'street';
  world.party.husband = ['liuwenxia'];

  // 紫嫣在自己账号发话走动
  const intent4 = parseIntent({
    text: '回于家酒肆打点生意',
    actorId: 'liuwenxia',
    world,
  });
  const gate4 = checkGate(world, intent4);
  applyAction({ dataDir: 'fakeDir', world, intent: intent4, gate: gate4 });
  
  assert.strictEqual(world.actors.liuwenxia.location, 'wine_shop'); // 紫嫣回了酒肆
  assert.strictEqual(world.actors.husband.location, 'street');     // 相公仍在长街，没被拖拽！
  assert.strictEqual(world.party.husband.includes('liuwenxia'), false); // 自动脱离队伍！
  console.log('✅ ④ 验收通过：队员自己账号走动 → 自动脱队，相公未被拖拽！');
}

console.log('🎉 同行邀约与转场机制流程图全景测试 100% 通过！');

