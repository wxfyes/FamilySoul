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

// ── 11. 随身行囊白名单备物与非法垃圾物品自愈清洗不变量 ──
const { prepareHouseholdItem, sanitizeHusbandItems } = await import('../src/world/items.js');
const testSupplyWorld = {
  items: [
    { id: 'it_ok1', name: '临江府都司·紫金虎符与官印', kind: '官印', holder: 'husband' },
    { id: 'it_ok2', name: '紫阳山头春茶（明前极品锡罐）', kind: '茗茶', holder: 'husband' },
    { id: 'it_ok3', name: '运河酒楼契', kind: '契纸', holder: 'husband' },
    { id: 'it_bad1', name: '办了', kind: '随身礼', holder: 'husband' },
    { id: 'it_bad2', name: '拟个章程出', kind: '随身礼', holder: 'husband' },
    { id: 'it_bad3', name: '说即可', kind: '随身礼', holder: 'husband' },
    { id: 'it_bad4', name: '口一会儿', kind: '随身礼', holder: 'husband' },
  ],
  actors: { husband: { id: 'husband', name: '王甯' } },
};
// 验证自然语言口语严禁被创建为物品
const badPrep1 = prepareHouseholdItem(testSupplyWorld, '办了', '沈婉儿');
const badPrep2 = prepareHouseholdItem(testSupplyWorld, '拟个章程出来', '沈婉儿');
const goodPrep = prepareHouseholdItem(testSupplyWorld, '明前春茶', '沈婉儿');
assertInvariant(badPrep1 === null && badPrep2 === null, '非白名单日常口语或动词短语绝对严禁被创建为随身物品');
assertInvariant(goodPrep?.item?.name.includes('春茶'), '白名单物资（如春茶）必须正常备置');

// 验证自愈净化函数清洗掉所有非法动词垃圾
const cleanedCount = sanitizeHusbandItems(testSupplyWorld);
assertInvariant(cleanedCount === 4, '行囊自愈净化必须准确识别并清除 4 件垃圾动词物品');
assertInvariant(testSupplyWorld.items.length === 3 && !testSupplyWorld.items.some(x => ['办了', '拟个章程出', '说即可', '口一会儿'].includes(x.name)), '非法垃圾物品必须彻底从行囊中扫除');

// ── 12. 古风官员与闺秀尊称社会身份排他性不变量 ──
const yangHousePresent = [
  { id: 'xiaocui', name: '小翠', role: '通房大丫鬟' },
  { id: 'yangzhenhua', name: '杨采儿', role: '知府千金' },
  { id: 'yangshenzhi', name: '杨慎之', role: '临江知府' },
  { id: 'luchen', name: '陆沉', role: '统领' },
];
const hitOfficial = findTargetActorInText(yangHousePresent, '杨大人好');
const hitMaiden = findTargetActorInText(yangHousePresent, '杨千金好');
const hitDirectMaiden = findTargetActorInText(yangHousePresent, '采儿近来可好');
assertInvariant(hitOfficial?.id === 'yangshenzhi', '在中堂呼唤「杨大人」必须 100% 命中正三品知府杨慎之，严禁被同姓千金杨采儿冒领');
assertInvariant(hitMaiden?.id === 'yangzhenhua', '在中堂呼唤「杨千金」必须 100% 命中千金杨采儿，严禁冒领给知府老父');
assertInvariant(hitDirectMaiden?.id === 'yangzhenhua', '在中堂呼唤「采儿」必须精准命中杨采儿');

// ── 13. 递信在场绝对排他与提笔回信生效不变量 ──
const { dispatchNaturalProactive } = await import('../src/world/clock.js');
const testProactiveWorld = {
  clock: { day: 25, hour: 19 },
  flags: { lastNaturalProactiveRealMs: 0, proactiveRound: 9 }, // 第 10 条本来是杨采儿
  actors: {
    husband: { id: 'husband', location: 'yang_mansion__hall' },
    yangzhenhua: { id: 'yangzhenhua', name: '杨采儿', location: 'yang_mansion__hall' },
  },
  places: {
    yang_mansion__hall: { id: 'yang_mansion__hall', name: '杨府·中堂大厅' },
  },
  proactive: [],
  correspondence: [],
};
dispatchNaturalProactive(testProactiveWorld, Date.now());
const queuedItem = testProactiveWorld.proactive[0];
assertInvariant(!queuedItem || (!queuedItem.speaker.includes('杨采儿') && queuedItem.actorId !== 'yangzhenhua'), '当相公与杨采儿同在杨府中堂时，系统绝对严禁分发采儿的来信/递信');

// ── 14. 官职称号纯正古风中文与杜绝裸露英文不变量 ──
const { deriveTitle, refreshTitles } = await import('../src/world/occupation.js');
const testOfficialWorld = {
  court: {
    offices: {
      prefect: { title: '临江知府', holder: 'yangshenzhi', vacant: false },
    },
  },
  actors: {
    yangshenzhi: { id: 'yangshenzhi', name: '杨慎之', office: 'prefect', role: '临江知府' },
  },
};
const derivedPrefect = deriveTitle(testOfficialWorld, testOfficialWorld.actors.yangshenzhi);
assertInvariant(!/[a-zA-Z]/.test(derivedPrefect) && (derivedPrefect.includes('知府') || derivedPrefect === '临江知府'), '官职 prefect 必须被推导为纯正古风「知府」，严禁输出裸露英文代码');
testOfficialWorld.actors.yangshenzhi.title = 'prefect';
refreshTitles(testOfficialWorld);
assertInvariant(testOfficialWorld.actors.yangshenzhi.title !== 'prefect' && !/[a-zA-Z]/.test(testOfficialWorld.actors.yangshenzhi.title), 'refreshTitles 必须自动将任何英文 title 清洗为纯正古风中文官名');

// ── 15. 四海钱庄实业资产与大朝奉归位不变量 ──
const testBankWorld = {
  places: {},
  actors: { husband: { id: 'husband', location: 'street', bag: [] } },
  assets: { silver: 1000, properties: [] },
  marriages: [],
  milestones: [],
};
healWorld(testBankWorld);
const sihaiProp = testBankWorld.assets.properties.find((p) => p && (p.id === 'sihai_bank' || p.name === '四海钱庄'));
assertInvariant(!!sihaiProp, '四海钱庄必须权威落账至 world.assets.properties');
assertInvariant(Number(sihaiProp?.incomePerDay || 0) >= 40, '四海钱庄每日额定日入必须 >= 40 两');
assertInvariant(testBankWorld.actors.qianwenyuan?.role === '大朝奉', '四海钱庄必须配备大朝奉钱文渊主管钱水');
assertInvariant(!!testBankWorld.places['sihai_bank'], '四海钱庄必须拥有独立实体物理空间');

// ── 16. 杨采儿正室·平妻并嫡法定名分与婚书不变量 ──
const caierMarriage = (testBankWorld.marriages || []).find((m) => m && (m.who === 'yangzhenhua' || m.wifeId === 'yangzhenhua' || m.name === '杨采儿' || m.wifeName === '杨采儿'));
assertInvariant(!!caierMarriage, '杨采儿必须权威登记入 world.marriages 婚配簿');
assertInvariant(caierMarriage?.status === '平妻' || caierMarriage?.rank?.includes('平妻'), '杨采儿名分必须为明媒正娶之平妻/正室');
const caierCert = itemsOf(testBankWorld, 'husband').find((item) => (item.name || '').includes('杨采儿') && (item.name || '').includes('婚书'));
assertInvariant(!!caierCert, '相公随身行囊必须核发《杨采儿平妻婚书》');

// ── 17. 通用实业商号提纯与动态落账引擎不变量 ──
const { extractBusinessName, ensureProjectProperty } = await import('../src/world/projects.js');
const rawTitle1 = '买下长风镖局铺面';
const rawTitle2 = '第25日1时 王记药铺开张本钱，取银入公账';
assertInvariant(extractBusinessName(rawTitle1) === '长风镖局', 'extractBusinessName 必须准确提纯「买下长风镖局铺面」为「长风镖局」');
assertInvariant(extractBusinessName(rawTitle2) === '王记药铺', 'extractBusinessName 必须准确提纯复杂记账流水为纯净字号「王记药铺」');

const dynamicWorld = {
  assets: { properties: [] },
  places: {},
  flags: {},
  notes: [],
  clock: { day: 26, hour: 10 },
};
const pBiaoju = ensureProjectProperty(dynamicWorld, rawTitle1, 400, { title: rawTitle1 });
assertInvariant(pBiaoju?.name === '长风镖局', '新产业必须自动建立为纯净字号「长风镖局」');
assertInvariant(pBiaoju?.category === '车马镖运' && pBiaoju?.kind === 'logistics_land', '长风镖局必须自动识别为车马镖运品类');
assertInvariant(Number(pBiaoju?.incomePerDay) >= 20, '长风镖局每日基准日入必须依据本钱自动测算');
assertInvariant(!!dynamicWorld.places[pBiaoju.placeId], '长风镖局必须全自动挂载独立物理空间');

// ── 18. 通用大乾婚聘礼法流水线（任意名门千金迎娶）不变量 ──
const { executeMarriageAlliance } = await import('../src/world/marriage.js');
const testWeddingWorld = {
  actors: {
    husband: { id: 'husband', name: '王甯' },
    maiden_su: { id: 'maiden_su', name: '苏映雪', role: '江南世家嫡女', origin: 'noble', father: 'elder_su' },
    elder_su: { id: 'elder_su', name: '苏老爷', role: '金陵名士', relations: {} },
  },
  items: [],
  places: {},
  bonds: {},
  marriages: [],
  notes: [],
  clock: { day: 26, hour: 10 },
};
const wedRes = executeMarriageAlliance(testWeddingWorld, {
  wifeId: 'maiden_su',
  rank: '名门侧室',
  dowry: 300,
});
assertInvariant(wedRes.ok === true, '通用婚聘礼法流水线必须顺利推演');
assertInvariant(testWeddingWorld.marriages.some((m) => m.who === 'maiden_su' && m.status === '侧室'), '苏映雪必须权威登册为侧室');
assertInvariant(testWeddingWorld.bonds.husband?.elder_su?.type === '岳婿', '迎娶苏映雪后必须全自动建立相公与苏老爷之岳婿羁绊');
const suCert = itemsOf(testWeddingWorld, 'husband').find((it) => it.name.includes('苏映雪') && it.name.includes('婚书'));
assertInvariant(!!suCert, '迎娶任何名门女子后，相公随身行囊必须全自动核发专属大红官押婚书');

// ── 19. 官制升迁卸任开缺与杜绝一人霸占全场官职不变量 ──
const testPromoWorld = {
  court: {
    offices: {
      tuanlian: { title: '临江府乡勇团练使', holder: 'husband', vacant: false },
      dusi: { title: '临江府都司', holder: 'husband', vacant: false },
      tiduzongbing: { title: '江南水陆提督总兵官', holder: 'husband', vacant: false },
      prefect: { title: '临江知府', holder: 'yangshenzhi', vacant: false },
      'city:临江府': { title: '临江知府', holder: 'yangshenzhi', vacant: false },
    },
  },
  actors: { husband: { id: 'husband' } },
  places: {},
  assets: { properties: [] },
  marriages: [],
  milestones: [],
};
healWorld(testPromoWorld);
const pOffices = testPromoWorld.court.offices;
assertInvariant(pOffices.tiduzongbing?.holder === 'husband', '水陆提督最高官职必须由相公实授现任');
assertInvariant(pOffices.tuanlian?.holder === null && pOffices.tuanlian?.vacant === true, '升任提督后低阶团练使必须规范卸任开缺，严禁一人霸占');
assertInvariant(pOffices.dusi?.holder === null && pOffices.dusi?.vacant === true, '升任提督后低阶都司必须规范卸任开缺');
assertInvariant(!pOffices.prefect, '冗余之中枢知府 prefect 必须清除，统一归入地方各府知府');

// ── 20. 提督王府升格与全府子房间正名不变量 ──
const { upgradeToMansionPalace, assignChamber, assignStaffQuarters } = await import('../src/world/residence.js');
const testPalaceWorld = {
  assets: {
    properties: [
      { id: 'wang_mansion', name: '临江·王宅（七进大宅）', placeId: 'husband_room' },
    ],
  },
  places: {
    husband_room: { id: 'husband_room', name: '临江·王宅·正房暖阁' },
    wang_mansion_east: { id: 'wang_mansion_east', name: '临江·王宅·东跨院' },
    wang_mansion_west: { id: 'wang_mansion_west', name: '临江·王宅·西跨院' },
  },
  actors: {
    husband: { id: 'husband', role: '江南水陆提督总兵官' },
  },
  milestones: [],
};
const upgRes = upgradeToMansionPalace(testPalaceWorld);
assertInvariant(upgRes.ok === true, '水陆提督开府建牙，宅邸必须顺利升格');
assertInvariant(testPalaceWorld.assets.properties[0].name.includes('提督王府'), '府邸资产名必须包含「提督王府」');
assertInvariant(testPalaceWorld.places.husband_room.name === '临江·提督王府·正房暖阁', '正房名号必须统一正名为「临江·提督王府·正房暖阁」');
assertInvariant(testPalaceWorld.places.wang_mansion_east.name === '临江·提督王府·东跨院', '东跨院名号必须统一正名为「临江·提督王府·东跨院」');

// ── 21. 平妻杨采儿并嫡正房与内眷自由分房令不变量 ──
const testChamberWorld = {
  places: {
    husband_room: { id: 'husband_room', name: '临江·提督王府·正房暖阁' },
    wang_mansion_east: { id: 'wang_mansion_east', name: '临江·提督王府·东跨院' },
    wang_mansion_west: { id: 'wang_mansion_west', name: '临江·提督王府·西跨院' },
  },
  actors: {
    husband: { id: 'husband', location: 'husband_room' },
    yangzhenhua: { id: 'yangzhenhua', name: '杨采儿', role: '正室·平妻', location: 'wang_mansion_east', home: 'wang_mansion' },
    cuiwanning: { id: 'cuiwanning', name: '崔婉宁', role: '侧室', location: 'husband_room', home: 'husband_room' },
  },
};
// 调配采儿住正房
const assignCaier = assignChamber(testChamberWorld, '采儿', '正房暖阁', { orderedBy: 'husband' });
assertInvariant(assignCaier.ok === true, '相公恩旨调配采儿住正房暖阁必须成功生效');
assertInvariant(testChamberWorld.actors.yangzhenhua.quarters === 'husband_room', '采儿的 quarters 必须指向正房');
assertInvariant(testChamberWorld.actors.yangzhenhua.location === 'husband_room', '采儿必须物理移步至正房');
assertInvariant(testChamberWorld.actors.yangzhenhua.assignedRoom === 'husband_room', '相公钦定住处必须记录 assignedRoom');

// 调配婉宁住东跨院
const assignWanning = assignChamber(testChamberWorld, '婉宁', '东跨院', { orderedBy: 'husband' });
assertInvariant(assignWanning.ok === true, '相公调配婉宁住东跨院必须成功生效');
assertInvariant(testChamberWorld.actors.cuiwanning.quarters === 'wang_mansion_east', '婉宁居所必须权威确立为东跨院');

// 巡检防护：相公钦定的住处绝不可被默认规则覆盖
assignStaffQuarters(testChamberWorld, 'husband_room');
assertInvariant(testChamberWorld.actors.yangzhenhua.quarters === 'husband_room', '自动巡检绝不可覆盖相公钦定之采儿正房住处');
assertInvariant(testChamberWorld.actors.cuiwanning.quarters === 'wang_mansion_east', '自动巡检绝不可覆盖相公钦定之婉宁东跨院住处');

// ── 22. 剧情人物即时具象化引擎不变量 ──
const { materializeNarrativeActor, autoMaterializeFromDialogue } = await import('../src/world/dynamic-actor.js');
const testDynWorld = {
  actors: { husband: { id: 'husband', name: '王甯' } },
  places: { street: { name: '临江长街' }, yamen: { name: '临江府衙' } },
  events: [],
  clock: { day: 26, hour: 12 },
};
const newActor = materializeNarrativeActor(testDynWorld, {
  name: '汪德润',
  role: '扬州大盐商',
  notes: '客商寿宴引荐',
});
assertInvariant(!!newActor && newActor.name === '汪德润', '剧情提及的汪德润必须被成功具象化');
assertInvariant(!!testDynWorld.actors[newActor.id], '新角色必须成功注册入 world.actors 字典');
assertInvariant(newActor.gender === 'male', '汪德润性别必须正确推导为男性');
assertInvariant(newActor.relations.husband.trust >= 50, '新角色必须自动建立与相公的世情关系账本');

const dialogueText = '【知县·周文达】：相公，今日运河督粮官【粮道·赵世诚】与【掌柜·孙大福】已抵临江。';
const spawnedList = autoMaterializeFromDialogue(testDynWorld, dialogueText);
assertInvariant(spawnedList.some((a) => a.name === '赵世诚'), '从剧情对话中必须全自动提取并具象化「赵世诚」');
assertInvariant(spawnedList.some((a) => a.name === '孙大福'), '从剧情对话中必须全自动提取并具象化「孙大福」');

// ── 23. 京师与皇宫大内空间健全断言 ──
const { initCapitalWorld, isCapitalPlace, isForbiddenCityPlace } = await import('../src/world/capital.js');
const testCapWorld = { places: {}, assets: { realEstates: [] }, events: [] };
initCapitalWorld(testCapWorld);
assertInvariant(isForbiddenCityPlace('palace_throne_hall'), '金銮宝殿太和殿必须属于紫禁城皇宫空间');
assertInvariant(isForbiddenCityPlace('palace_wenhua'), '文华殿内阁必须属于紫禁城皇宫空间');
assertInvariant(isForbiddenCityPlace('palace_qianqing'), '乾清宫御书房必须属于紫禁城皇宫空间');
assertInvariant(isCapitalPlace('capital_mansion'), '京师提督王府必须属于京师核心空间');
assertInvariant(testCapWorld.assets.properties.some((r) => r.id === 'capital_mansion'), '提督王府必须入相公资产账本');
assertInvariant(Object.keys(testCapWorld.places.capital_mansion.rooms || {}).length >= 20, '京师提督王府必须完整具备 20 处以上九进院落房间');
assertInvariant(!!testCapWorld.places.capital_mansion__garden, '京师提督王府必须包含万景御花园');
assertInvariant(!!testCapWorld.places.capital_mansion__drill, '京师提督王府必须包含亲兵演武校场');
assertInvariant(!!testCapWorld.places.capital_mansion__study, '京师提督王府必须包含文澜御书房');
assertInvariant(!!testCapWorld.actors.staff_bj_butler, '京师提督王府必须有王府大总管王福当差');
assertInvariant(!!testCapWorld.actors.staff_bj_guard_leader, '京师提督王府必须有亲兵营统领赵铁山当差');

// ── 24. 中枢朝堂与四大党争派系健全断言 ──
const { initCourtOffices, appointOfficial, dismissOfficial, getHusbandMilitaryCommand } = await import('../src/world/court.js');
const testCourtWorld = { court: {}, actors: { husband: { name: '王甯' } }, events: [] };
initCourtOffices(testCourtWorld);
assertInvariant(!!testCourtWorld.court.offices.chancellor, '中枢内阁首辅职位必须存在');
assertInvariant(testCourtWorld.court.offices.chancellor.faction === 'chancellor', '首辅崔元礼初始派系为相党');
assertInvariant(!!testCourtWorld.court.factions.court && !!testCourtWorld.court.factions.husband, '四大党争派系（帝党、相党、王党、清流）必须完备');

// 弹劾削职断言
const dismissRes = dismissOfficial(testCourtWorld, '兵部尚书', { reason: '贪渎受贿', impeachedBy: 'husband' });
assertInvariant(dismissRes.ok === true, '弹劾兵部尚书必须成功');
assertInvariant(testCourtWorld.court.offices.war.vacant === true, '兵部尚书被削职后必须处于空缺状态');

// 拜官提拔断言
const appointRes = appointOfficial(testCourtWorld, '兵部尚书', '韩崇', { appointedBy: 'husband' });
assertInvariant(appointRes.ok === true, '提拔心腹继任兵部尚书必须成功');
assertInvariant(testCourtWorld.court.offices.war.faction === 'husband', '提拔后的新任尚书派系必须归顺王党');

// 天下兵符节制断言
const militaryCmd = getHusbandMilitaryCommand(testCourtWorld);
assertInvariant(militaryCmd.totalTroops >= 50000, '从一品水陆提督节制天下兵马总兵力必须达 5 万以上');
assertInvariant(militaryCmd.divisions.some((d) => d.name.includes('神机')), '必须包含神机亲营');

// ── 25. 攻城掠地闭环断言 ──
const { commandSiegeCity } = await import('../src/world/warfare.js');
const testSiegeWorld = {
  cities: { 太原府: { defense: 60, garrison: 3000, unrest: 10 } },
  assets: { silver: 1000 },
  memories: [],
  milestones: [],
  events: [],
};
const siegeRes = await commandSiegeCity(testSiegeWorld, '太原府', { troops: 35000, tactic: 'siege_engine' });
assertInvariant(siegeRes.ok === true, '挥师出征太原府必须成功执行');
assertInvariant(siegeRes.victory === true, '兵力优势与神机营攻城器械必须取得大捷');
assertInvariant(testSiegeWorld.cities.太原府.owner === 'husband', '破城后城池所有权必须易帜归相公');
assertInvariant(testSiegeWorld.assets.silver > 1000, '破城缴获太原府库白银必须入相公私库');

// ── 4. 总结与退出码 ──
console.log('');
if (errors > 0) {
  console.error(`💥 不变量检查失败！共有 ${errors} 项核心红线被违背，严禁发布！`);
  process.exit(1);
} else {
  console.log('🎉 所有核心业务不变量全部完好，系统安全稳健！');
}
