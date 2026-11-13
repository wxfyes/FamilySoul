/**
 * 核心业务不变量守护测试（System Invariants Guard）
 *
 * 本脚本是系统的物理底线守护神：
 * 任何代码修改、重构或数据流转，若违背了以下任何一条不变量，
 * 必须立刻以非零状态码退出并报错，绝对不允许打包或部署！
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isPropertyOperational, getPropertyNominalIncome, calculateDailyIncome } from '../src/world/properties.js';
import { isMarriageable, isProtectedFemale, getHusbandHouseholdRoster } from '../src/world/marriage.js';
import { moveActor, isHumanBound } from '../src/world/position.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let errors = 0;
function assertInvariant(condition, desc) {
  if (!condition) {
    console.error(`❌ [不变量违背] ${desc}`);
    errors++;
  } else {
    console.log(`✅ [不变量守护] ${desc}`);
  }
}

console.log('🛡️ 开始执行 FamilySoul 核心业务不变量断言检查...\n');

// ── 1. 产业不变量断言 ──
const mockRestaurant = { id: 'canal_restaurant', name: '运河码头三层大酒楼', status: '正常营业', incomePerDay: 124.1, costSilver: 510 };
assertInvariant(getPropertyNominalIncome(mockRestaurant) >= 100, '运河码头三层大酒楼额定基准日入必须 >= 100 两（日进斗金铁律）');

const mockFleet = { id: 'prop_fleet', name: '王家运河大船队（一大三小）', status: '正常起航', costSilver: 730 };
assertInvariant(isPropertyOperational(mockFleet), '王家大船队「正常起航」状态必须被判定为正常营运产生收益');
assertInvariant(getPropertyNominalIncome(mockFleet) >= 40, '王家大船队额定基准日入必须 >= 40 两');

const mockSalt = { id: 'prop_salt', name: '码头盐铺', status: '已开张' };
assertInvariant(getPropertyNominalIncome(mockSalt) >= 20, '码头盐铺官盐商行额定基准日入必须 >= 20 两');

const mockWorld = {
  clock: { day: 10, hour: 12 },
  cities: { 临江府: { price: 100, unrest: 0 } },
  actors: { husband: { name: '王甯' } }
};
const gain = calculateDailyIncome(mockWorld, mockRestaurant);
assertInvariant(gain >= 124.1, '大酒楼当日日结收益绝不可低于额定基准 124.1 两');
assertInvariant(mockRestaurant.incomePerDay >= 124.1, '大酒楼额定日入绝不可被行情反向冲刷削减');

// ── 2. 提示词纯净度不变量断言 ──
const rolesDir = path.join(ROOT, 'roles');
const roleFiles = fs.readdirSync(rolesDir).filter((f) => f.endsWith('.md'));
for (const rf of roleFiles) {
  const content = fs.readFileSync(path.join(rolesDir, rf), 'utf8');
  assertInvariant(!content.includes('杨振华'), `角色文件 roles/${rf} 严禁包含废弃名字「杨振华」`);
  // 检查是否在正面描述中把酒楼写成没买（排除严禁令行）
  const badLines = content.split('\n').filter((line) => !/严禁|禁止|绝不/.test(line) && /酒楼.*(?:还没买|未盘下|打算买|去看铺面|筹备开业)/.test(line));
  assertInvariant(badLines.length === 0, `角色文件 roles/${rf} 严禁否定相公全款盘下大酒楼盛大开业的事实`);
  assertInvariant(!/崔婉宁.*(?:寡妇|亡故)/.test(content), `角色文件 roles/${rf} 严禁污蔑侧室崔婉宁闺秀名节`);
}

// ── 3. 大事记资产一致性不变量断言 ──
const milestonesPath = path.join(ROOT, 'data/world/milestones.json');
if (fs.existsSync(milestonesPath)) {
  const rawText = fs.readFileSync(milestonesPath, 'utf8');
  const has510 = rawText.includes('五百一十两') && rawText.includes('大酒楼');
  assertInvariant(has510, '大事记账本 data/world/milestones.json 必须完整包含 510 两买下运河大酒楼的大事');
}

// ── 4. 核心女眷保护与民间拉郎配物理阻断断言 ──
const mockProtectedWorld = {
  places: { backyard: { name: '后院暖阁' }, husband_room: { name: '正房卧房' }, street: { name: '临江长街' } },
  actors: {
    waner: { id: 'waner', name: '沈婉儿', role: '大娘子', gender: 'female', age: 19 },
    yunnia: { id: 'yunnia', name: '林芸娘', role: '二房如夫人', gender: 'female', age: 18 },
    yangcaier: { id: 'yangcaier', name: '杨采儿', role: '知府千金', gender: 'female', age: 18 },
    cuiwanning: { id: 'cuiwanning', name: '崔婉宁', role: '侧室', gender: 'female', age: 19 },
    peddler: { id: 'npc_peddler', name: '王小二', role: '脚夫', gender: 'male', age: 22 },
    maid: { id: 'npc_maid', name: '春花', role: '市井民女', gender: 'female', age: 20 },
    husband: { id: 'husband', name: '王甯', location: 'husband_room' }
  }
};
assertInvariant(!isMarriageable(mockProtectedWorld, mockProtectedWorld.actors.yangcaier), '知府千金杨采儿绝对严禁参与民间搭桥婚配（严禁拉郎配）');
assertInvariant(!isMarriageable(mockProtectedWorld, mockProtectedWorld.actors.waner), '正妻沈婉儿绝对严禁参与民间搭桥婚配');
assertInvariant(!isMarriageable(mockProtectedWorld, mockProtectedWorld.actors.yunnia), '二房林芸娘绝对严禁参与民间搭桥婚配');
assertInvariant(!isMarriageable(mockProtectedWorld, mockProtectedWorld.actors.cuiwanning), '名门侧室崔婉宁绝对严禁参与民间搭桥婚配');
assertInvariant(isMarriageable(mockProtectedWorld, mockProtectedWorld.actors.maid), '普通市井民女正常允许参与民间结亲');

const householdRoster = getHusbandHouseholdRoster(mockProtectedWorld);
assertInvariant(householdRoster.some((m) => m.id === 'waner' && m.rank.includes('大娘子')), '后宅谱系必须权威包含正妻沈婉儿');
assertInvariant(householdRoster.some((m) => m.id === 'yunnia' && m.rank.includes('二房')), '后宅谱系必须权威包含二房林芸娘');
assertInvariant(householdRoster.some((m) => m.id === 'cuiwanning' && m.rank.includes('侧室')), '后宅谱系必须权威包含侧室崔婉宁');

// ── 5. 真人（相公）物理移动防护断言 ──
assertInvariant(isHumanBound(mockProtectedWorld, 'husband'), '相公 husband 必须恒等于真人绑定状态');
const illegalMove = moveActor(mockProtectedWorld, 'husband', 'street', 'world', '系统后台试图挪动');
assertInvariant(illegalMove.ok === false, '相公绝对拒绝一切后台 world 自动位移，只能由相公界面操作');
assertInvariant(mockProtectedWorld.actors.husband.location === 'husband_room', '相公位置在非法移动调用后必须保持原状不变');

// ── 6. 智能对话指名道姓优先级不变量 ──
const { findTargetActorInText } = await import('../src/world/naming.js');
const mockActors = {
  waner: { id: 'waner', name: '沈婉儿', role: '正妻' },
  caier: { id: 'yangzhenhua', name: '杨采儿', role: '知府千金' },
};
const hitActor = findTargetActorInText(mockActors, '采儿，去把婉儿叫来');
assertInvariant(hitActor && hitActor.name === '杨采儿', '相公说“采儿，去把婉儿叫来”必须精准命中杨采儿为交谈主答对象');

// ── 7. 队伍脱队单一成员精准不变量 ──
const { parseIntent } = await import('../src/world/intent.js');
const mockWorldForParty = {
  actors: {
    husband: { id: 'husband', name: '王甯' },
    waner: { id: 'waner', name: '沈婉儿' },
    caier: { id: 'yangzhenhua', name: '杨采儿' },
  },
  party: { husband: ['husband', 'waner', 'yangzhenhua'] },
};
const leaveIntent = parseIntent({ text: '婉儿你先回去吧', actorId: 'husband', world: mockWorldForParty });
assertInvariant(leaveIntent.params?.leaveParty === 'waner', '相公吩咐“婉儿你先回去吧”必须只令婉儿一人脱队，绝不可误判为 all 全员解散');

// ── 8. 杨府对相公拜访通行不变量 ──
const { knock } = await import('../src/world/visit.js');
const mockYangMansion = {
  places: {
    yang_mansion: { id: 'yang_mansion', name: '杨府', residence: true, owner: 'yangshenzhi', rooms: { hall: { id: 'yang_mansion__hall', name: '中堂' } } },
  },
  actors: {
    husband: { id: 'husband', name: '王甯' },
    yangshenzhi: { id: 'yangshenzhi', name: '杨慎之', role: '临江知府' },
    yangzhenhua: { id: 'yangzhenhua', name: '杨采儿', role: '知府千金' },
  },
};
const knockRes = knock(mockYangMansion, 'husband', 'yang_mansion');
assertInvariant(knockRes.allowed === true, '相公拜访杨府必须被门房恭敬迎入中堂，绝不可被拒之门外');

// ── 9. 朝廷武勋正式文书官印入随身行囊与多波次匪患不变量 ──
const { ensureOfficialCredentials, getHusbandOfficialInfo, itemsOf, showItem } = await import('../src/world/items.js');
const { ensureActiveBanditWaves } = await import('../src/world/bandits.js');
const mockOffWorld = {
  clock: { day: 25, hour: 10 },
  court: {
    offices: {
      tuanlian: { holder: 'husband', title: '临江府乡勇团练使' },
      shoubei: { holder: 'husband', title: '临江府守备' },
      dusi: { holder: 'husband', title: '临江府都司' },
    },
  },
  cities: {
    临江府: { name: '临江府', region: '江南道' },
    扬州府: { name: '扬州府', region: '淮南道' },
    苏州府: { name: '苏州府', region: '江南道' },
    淮安府: { name: '淮安府', region: '淮南道' },
  },
  actors: {
    husband: { id: 'husband', name: '王甯' },
    clerk: { id: 'clerk', name: '钱书办', relations: { husband: { trust: 50 } } },
  },
  items: [],
  bandits: {},
};
ensureOfficialCredentials(mockOffWorld);
const offInfoTest = getHusbandOfficialInfo(mockOffWorld);
const husItemsTest = itemsOf(mockOffWorld, 'husband');
assertInvariant(offInfoTest.hasOffice && offInfoTest.highestTitle === '临江府都司', '相公官职信息必须准确识别最高实授官衔「临江府都司」');
assertInvariant(husItemsTest.some((it) => it.name.includes('临江府都司实授敕牒') && it.kind === '敕牒'), '相公随身行囊必须核发正式《兵部武选司·临江府都司实授敕牒》');
assertInvariant(husItemsTest.some((it) => it.name.includes('紫金虎符与官印') && it.kind === '官印'), '相公随身行囊必须核发正式《临江府都司·紫金虎符与官印》');
const sealItem = husItemsTest.find((it) => it.kind === '官印');
const showRes = showItem(mockOffWorld, 'husband', 'clerk', sealItem.id);
assertInvariant(showRes.ok && showRes.trustDelta >= 8 && showRes.line.includes('朝廷命官'), '相公当众亮出虎符官印必须展现朝廷命官威仪并提升在场者敬畏信任');
ensureActiveBanditWaves(mockOffWorld, 5);
assertInvariant(Object.keys(mockOffWorld.bandits).length >= 5, '江淮匪患池必须常备至少 5 波不同阶位匪患供相公出征立功升官');

// ── 10. 银两扣款单一写入口幂等防重与自愈退银不变量 ──
const { spendSilver } = await import('../src/world/ledger.js');
const { healWorld } = await import('../src/world/heal.js');
const mockLedgerWorld = {
  clock: { day: 25, hour: 1 },
  assets: { silver: 2000, properties: [] },
  ledger: [],
  actors: { husband: { id: 'husband', name: '王甯' } },
};
const s1 = spendSilver(mockLedgerWorld, 750, '王记当铺开张·开张', 'husband');
const s2 = spendSilver(mockLedgerWorld, 750, '王记当铺开张本钱，取银入公账', 'husband');
assertInvariant(s1.ok && !s1.deduplicated && mockLedgerWorld.assets.silver === 1250, '首笔合法开张支出必须正常扣减银两');
assertInvariant(s2.ok && s2.deduplicated === true && mockLedgerWorld.assets.silver === 1250 && mockLedgerWorld.ledger.length === 1, '同日同标的「王记当铺」二次扣款必须被单一写入口拦截，严禁双倍扣银');

// 模拟历史污染双倍流水，验证 healWorld 自动抹除重复行并全额退还 750 两
const pollutedWorld = {
  clock: { day: 25, hour: 1 },
  assets: { silver: 500, properties: [] },
  ledger: [
    { day: 25, hour: 1, delta: -750, title: '王记当铺开张·开张', by: 'husband', balance: 1250 },
    { day: 25, hour: 1, delta: -750, title: '王记当铺开张本钱，取银入公账', by: 'husband', balance: 500 },
  ],
  actors: { husband: { id: 'husband', name: '王甯' } },
};
healWorld(pollutedWorld);
assertInvariant(pollutedWorld.assets.silver === 1250 && pollutedWorld.ledger.length === 1, '自愈系统必须自动抹除同日重复扣款流水并将 750 两全额退回相公公账');

// ── 4. 总结与退出码 ──
console.log('');
if (errors > 0) {
  console.error(`💥 不变量检查失败！共有 ${errors} 项核心红线被违背，严禁发布！`);
  process.exit(1);
} else {
  console.log('🎉 所有核心业务不变量全部完好，系统安全稳健！');
}
