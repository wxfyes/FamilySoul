/**
 * 世界状态层 —— 唯一真相源
 *
 * 只用纯规则读写，不调用任何大模型。
 * 所有数据结构见 docs/world-engine.md 第 3、4 节。
 */
import { ensureBonds } from './bonds.js';
import { ensureFactions } from './factions.js';
import { inferAgeFromIdentity, inferMaritalStatus, inferGenderFromIdentity } from './persona.js';
import { ensureClans } from './clans.js';
import { repairTrespassHomes } from './dwelling.js';
import { linkCouples } from './couples.js';
import { buildAllResidences, relinkResidence, upgradeResidence, settleItinerants, buildPremises, buildCourts, pruneForeignRooms, pruneRemoteCourts, collapseRoomPlaces, assignStaffQuarters, demoteNestedMansions, linkSameHouseRooms } from './residence.js';
import { ensureGatekeeper } from './posts.js';
import { evictOutsiders } from './privacy.js';
import { ensureCityBase, ensureAllCityBases, ensureCityExtras, ensureCityClasses, ensureShopStaff, streetOfCity } from './city.js';
import { ensureMatchmaker, dailyMarriages, maybeOfferAlliance } from './marriage.js';
import { fallbackName } from './migration.js';
import { moneyCategory } from './ledger-rules.js';
import { ensureItems, addItem, itemsOf } from './items.js';
import { ensureResidence } from './residence.js';
import { refreshTitles } from './occupation.js';
import { ensureStalls } from './stalls.js';
import { ensureFame } from './reputation.js';
import { ensureMarket } from './prices.js';
import { moveActor } from './position.js';
import { syncMoney } from './money.js';
import { syncNames } from './identity.js';
import fs from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { lunarFromTable } from './lunar-table.js';
import path from 'node:path';
import { migrateMemories } from './memory.js';

export const STATE_VERSION = 1;

export function worldDir(dataDir) {
  return path.join(dataDir, 'world');
}
export function statePath(dataDir) {
  return path.join(worldDir(dataDir), 'state.json');
}
export function eventsPath(dataDir) {
  return path.join(worldDir(dataDir), 'events.jsonl');
}

/* ── 时间与节气 ─────────────────────────────────────────── */

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_CN = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
const WEATHERS = {
  spring: ['烟雨', '杏花微雨', '晴好', '薄阴'],
  summer: ['骤雨初歇', '蝉鸣日盛', '闷热', '雷雨将至'],
  autumn: ['天高气爽', '早晚微凉', '金风', '薄雾'],
  winter: ['北风微冷', '冷雨', '清寒', '阴云压城'],
};
const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export function seasonOf(day) {
  const idx = Math.floor(((Math.max(1, day) - 1) % 360) / 90);
  return SEASONS[idx] || 'spring';
}
export function seasonCN(season) {
  return SEASON_CN[season] || '春';
}
export function weatherOf(day, season) {
  const pool = WEATHERS[season] || WEATHERS.spring;
  return pool[Math.max(0, day) % pool.length];
}
export function shichenOf(hour) {
  return `${SHICHEN[Math.floor(((hour + 1) % 24) / 2)]}时`;
}
export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/* ── 读写 ───────────────────────────────────────────────── */

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function createInitialState(dataDir) {
  const milestones = readJson(path.join(worldDir(dataDir), 'milestones.json'));
  const completed = Array.isArray(milestones?.completedMilestones) ? milestones.completedMilestones : [];

  return {
    worldId: 'linjiang-main',
    version: STATE_VERSION,
    era: '乾宁三年',
    epoch: 'ancient',
    lastRealAt: 0,

    clock: {
      day: 1,
      hour: 9,
      season: 'spring',
      weather: '烟雨',
    },

    assets: {
      silver: 528,
      copper: 6,
      properties: [
        { id: 'tea_house', name: '临江茶坊老店', status: '正常营业', incomePerDay: 1.2, keeper: 'husband', owner: 'husband' },
        // 于家酒肆：紫嫣（刘文霞）自己的铺子，归在她名下
        { id: 'wine_shop', name: '于家酒肆', status: '正常营业', incomePerDay: 1.1, keeper: 'liuwenxia', owner: 'liuwenxia', city: '临江府' },
        // 于子归的营造行：土木包工
        { id: 'yujie_yard', name: '于家营造行', status: '正常营业', incomePerDay: 0.9, keeper: 'yujie', owner: 'yujie', city: '临江府' },
        {
          id: 'canal_restaurant',
          keeper: 'husband',
          owner: 'husband',
          name: '运河码头三层大酒楼',
          status: '筹备开张',
          incomePerDay: 0,
          costSilver: 510,
          placeId: 'canal_restaurant',
        },
      ],
    },

    places: {
      husband_room: { name: '正房', exits: ['tea_house', 'backyard'], owner: 'husband' },
    academy: { name: '临江书院', exits: ['street'], owner: 'court', kind: '书院' },
    temple: { name: '城隍庙', exits: ['street'], owner: 'court', kind: '庙' },
    jail_male: { name: '县衙男牢', exits: ['yamen'], owner: 'court' },
    jail_female: { name: '县衙女牢', exits: ['yamen'], owner: 'court' },
    // ── 街市：一条街该有的铺子 ──
    brothel: { name: '万花楼', exits: ['street'], owner: 'suyingxue', kind: '青楼' },
    casino: { name: '聚宝赌坊', exits: ['street'], owner: 'zhaoxing', kind: '赌坊' },
    inn: { name: '临江客栈', exits: ['street'], owner: 'sunjin', kind: '客栈' },
    candy_shop: { name: '甜记糖铺', exits: ['street'], owner: 'tangpo', kind: '糖铺' },
    cloth_shop: { name: '锦绣衣庄', exits: ['street'], owner: 'jinniang', kind: '衣铺' },
    rice_shop: { name: '恒丰米行', exits: ['street'], owner: 'milaoban', kind: '米铺' },
    smithy: { name: '周家铁铺', exits: ['street'], owner: 'zhoutie', kind: '铁匠铺' },
    pawnshop: { name: '永昌当', exits: ['street'], owner: 'danglaoban', kind: '当铺' },
    noodle_stall: { name: '王婆面摊', exits: ['street'], owner: 'wangpo', kind: '面摊' },
    tea_stall: { name: '县衙前茶摊', exits: ['yamen', 'street'], owner: 'public', kind: '茶摊' },
    butcher: { name: '张屠户肉铺', exits: ['street'], owner: 'zhangtu', kind: '肉铺' },
    pharmacy: { name: '回春堂药铺', exits: ['street'], owner: 'chenlangzhong', kind: '药铺' },
    tea_house: { name: '临江茶坊', exits: ['street', 'backyard', 'husband_room'], owner: 'husband' },
      backyard: { name: '后院暖阁', exits: ['tea_house'], owner: 'husband' },
      wine_shop: { name: '于家酒肆', exits: ['street'], dynamic: false, owner: 'liuwenxia' },
      goods_shop: { name: '翟家货栈', exits: ['street'], dynamic: false, owner: 'yangcaiyun' },
      street: { name: '青石板长街', exits: ['tea_house', 'yamen'], owner: 'public' },
      dock: { name: '运河码头', exits: ['street', 'canal_restaurant'], owner: 'public' },
      canal_restaurant: { name: '运河码头三层大酒楼', exits: ['dock'], owner: 'husband' },
      yang_mansion: { name: '杨府', exits: ['street'], owner: 'yangzhenhua' },
      yamen: { name: '临江县衙', exits: ['street'], owner: 'court' },
      suijia_house: { name: '临江府·随家小院', exits: ['street'], owner: 'zhanjing', city: '临江府' },
    },

    actors: {
      husband: {
        id: 'husband',
        name: '王甯',
        role: '相公',
        gender: 'male',
        playerControlled: true,
        location: 'tea_house',
        relations: {},
        intimacy: {},
      },
      suyingxue: { id: 'suyingxue', name: '苏映雪', role: '万花楼老鸨', gender: 'female', home: 'brothel', location: 'brothel', goals: ['把万花楼撑住', '寻个靠得住的贵人'], secret: '楼里有官面上的暗股', relations: { husband: { trust: 35, desire: 20, fear: 10, grievance: 0 } }, schedule: [{ at: 14, do: '在楼上招呼客人', place: 'brothel' }, { at: 2, do: '收档算账', place: 'brothel' }] },
      zhaoxing: { id: 'zhaoxing', name: '赵兴', role: '聚宝赌坊东家', gender: 'male', home: 'casino', location: 'casino', goals: ['把赌坊开到码头'], secret: '他欠了漕帮一笔印子钱', relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 12, do: '坐庄', place: 'casino' }] },
      sunjin: { id: 'sunjin', name: '孙进', role: '临江客栈掌柜', gender: 'male', home: 'inn', location: 'inn', goals: ['把客栈做成南来北往第一站'], relations: { husband: { trust: 32, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 6, do: '开门迎客', place: 'inn' }] },
      tangpo: { id: 'tangpo', name: '唐婆', role: '甜记糖铺', gender: 'female', home: 'candy_shop', location: 'candy_shop', goals: ['给孙子攒钱'], relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 7, do: '熬糖', place: 'candy_shop' }] },
      jinniang: { id: 'jinniang', name: '锦娘', role: '锦绣衣庄掌柜', gender: 'female', home: 'cloth_shop', location: 'cloth_shop', goals: ['做成城里第一衣庄'], secret: '她给官眷私下改过衣裳', relations: { husband: { trust: 34, desire: 15, fear: 0, grievance: 0 } }, schedule: [{ at: 8, do: '裁衣量体', place: 'cloth_shop' }] },
      milaoban: { id: 'milaoban', name: '米老板', role: '恒丰米行', gender: 'male', home: 'rice_shop', location: 'rice_shop', goals: ['囤粮待价'], relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 6, do: '看仓', place: 'rice_shop' }] },
      zhoutie: { id: 'zhoutie', name: '周铁', role: '铁匠', gender: 'male', home: 'smithy', location: 'smithy', goals: ['打出一把好刀'], relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 7, do: '打铁', place: 'smithy' }] },
      danglaoban: { id: 'danglaoban', name: '曹当', role: '永昌当老板', gender: 'male', home: 'pawnshop', location: 'pawnshop', goals: ['收尽城中急当的好东西'], secret: '他手里压着几张来路不明的契', relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 9, do: '验当', place: 'pawnshop' }] },
      wangpo: { id: 'wangpo', name: '王婆', role: '面摊', gender: 'female', home: 'noodle_stall', location: 'noodle_stall', goals: ['守着摊子过活'], relations: { husband: { trust: 33, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 5, do: '下面', place: 'noodle_stall' }] },
      zhangtu: { id: 'zhangtu', name: '张屠户', role: '肉铺', gender: 'male', home: 'butcher', location: 'butcher', goals: ['多攒几亩田'], relations: { husband: { trust: 26, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 5, do: '开案', place: 'butcher' }] },
      chenlangzhong: { id: 'chenlangzhong', name: '陈郎中', role: '回春堂郎中', gender: 'male', home: 'pharmacy', location: 'pharmacy', goals: ['把回春堂传下去'], relations: { husband: { trust: 35, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 8, do: '坐堂问诊', place: 'pharmacy' }] },
      shuyuan: { id: 'shuyuan', name: '老夫子', role: '书院先生', gender: 'male', home: 'academy', location: 'academy', goals: ['教出几个中举的'], relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 7, do: '讲学', place: 'academy' }, { at: 16, do: '批课业', place: 'academy' }] },
      monk: { id: 'monk', name: '慧明和尚', role: '城隍庙住持', gender: 'male', home: 'temple', location: 'temple', goals: ['香火不断'], relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 5, do: '早课', place: 'temple' }] },
      leiqi: { id: 'leiqi', name: '雷七', role: '漕帮帮主', gender: 'male', home: 'dock', location: 'dock', goals: ['码头只归漕帮说话'], secret: '他与县衙书吏有旧账往来', relations: { husband: { trust: 25, desire: 0, fear: 0, grievance: 5 } }, schedule: [{ at: 7, do: '在码头点船', place: 'dock' }] },
      county_magistrate: { id: 'county_magistrate', name: '周文达', role: '临江县令', gender: 'male', home: 'yamen', location: 'yamen', goals: ['三年考绩升迁', '把这县的案子判清楚'], secret: '他收过钱通海一份年礼', relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 9, do: '升堂理事', place: 'yamen' }, { at: 17, do: '退堂', place: 'yamen' }] },
      coroner: { id: 'coroner', name: '老宋', role: '仵作', gender: 'male', home: 'yamen', location: 'yamen', goals: ['少惹事'], relations: { husband: { trust: 25, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 8, do: '在衙里待命', place: 'yamen' }] },
      waner: {
        id: 'waner', gender: 'female', home: 'backyard',
        name: '沈婉儿',
        role: '正妻',
        label: '正妻',
        household: true,
        location: 'tea_house',
        goals: ['保住王家体面', '把运河大酒楼妥善经营开张', '操持中馈、为王家开枝散叶'],
        secret: '贴身收着沈家祖传的一本贡茶焙制古谱，只待相公大酒楼开张时作压箱底招牌',
        relations: {
          husband: { trust: 72, desire: 58, fear: 2, grievance: 0 },
        },
        intimacy: { level: 3, tone: 1, lastAt: 0, ritual: 'solemn' },
        schedule: [
          { at: 7, do: '在柜台核账', place: 'tea_house' },
          { at: 11, do: '陪相公议事', place: 'tea_house' },
          { at: 21, do: '回后院温存', place: 'backyard' },
        ],
      },
      yunnia: {
        id: 'yunnia', gender: 'female', home: 'backyard',
        name: '林芸娘',
        role: '二房如夫人',
        label: '侧妾',
        household: true,
        location: 'backyard',
        goals: ['把柜台茶艺学精', '早日为相公诞下一男半女', '不给姐姐添乱'],
        secret: '偷偷向城中老郎中求了一剂温经求子的古方，每晚温水煎服',
        relations: {
          husband: { trust: 63, desire: 66, fear: 4, grievance: 0 },
        },
        intimacy: { level: 2, tone: 0, lastAt: 0, ritual: 'solemn' },
        schedule: [
          { at: 8, do: '在前街学看柜', place: 'tea_house' },
          { at: 19, do: '回东厢房歇息', place: 'backyard' },
        ],
      },
      xiaocui: {
        id: 'xiaocui', gender: 'female', servant: true, home: 'backyard',
        name: '小翠',
        role: '通房大丫鬟',
        label: '通房丫鬟',
        household: true,
        location: 'backyard',
        goals: ['把差事办利索', '讨大娘子点头开脸'],
        relations: { husband: { trust: 60, desire: 40, fear: 1, grievance: 0 } },
        schedule: [{ at: 20, do: '回后院伺候', place: 'backyard' }],
      },
      aji: {
        id: 'aji', gender: 'male', servant: true, home: 'tea_house', schedule: [{ at: 6, do: '开门生火、擦桌摆盏', place: 'tea_house' }, { at: 12, do: '往前街送茶点', place: 'street' }, { at: 18, do: '回茶坊收档', place: 'tea_house' }],
        name: '阿吉',
        role: '跑堂伙计',
        label: '跑堂伙计',
        location: 'tea_house',
        goals: ['把跑堂差事做出名堂'],
      },
      qiantonghai: {
        id: 'qiantonghai', gender: 'male', home: 'street', schedule: [{ at: 8, do: '在茶行坐馆收货', place: 'street' }, { at: 12, do: '聚贤楼请漕帮吃酒', place: 'dock' }, { at: 17, do: '回茶行盘账', place: 'street' }],
        name: '钱通海',
        role: '临江茶行行长',
        location: 'street',
        goals: ['夺下紫阳山头春茶'],
        secret: '暗中与巡检徐老虎分成',
        relations: {
          husband: { trust: 10, desire: 0, fear: 0, grievance: 45 },
        },
      },

      // ── 第二女主与她的侍卫（女主人真人账号可绑定到此 actor）──
      yangzhenhua: {
        id: 'yangzhenhua', gender: 'female', home: 'yang_mansion',
        name: '杨振华',
        role: '知府千金',
        label: '杨大小姐',
        location: 'yang_mansion',
        goals: ['游遍江南山水', '看看这城里有没有人入得了眼'],
        secret: '父亲正在暗中翻查沈家旧案，她并不知情',
        relations: {
          husband: { trust: 35, desire: 18, fear: 0, grievance: 0 },
        },
        intimacy: { level: 1, tone: 0, lastAt: 0, ritual: 'solemn' },
        schedule: [
          { at: 10, do: '乘轿出门赏玉', place: 'street' },
          { at: 16, do: '回府', place: 'yang_mansion' },
        ],
      },
      luchen: {
        id: 'luchen', gender: 'male', home: 'yang_mansion', schedule: [{ at: 7, do: '在杨府值守', place: 'yang_mansion' }, { at: 15, do: '跟着大小姐巡街', place: 'street' }, { at: 20, do: '回杨府换班', place: 'yang_mansion' }],
        name: '陆沉',
        role: '杨府侍卫统领',
        label: '陆统领',
        location: 'yang_mansion',
        goals: ['守好大小姐', '查清杨大人交办的那桩旧案'],
        secret: '受杨大人密令，暗查沈家获罪的卷宗',
        relations: {
          husband: { trust: 45, desire: 0, fear: 0, grievance: 0 },
        },
      },

      // ── 城中暗香 · 深宅怨妇（各自有明面家室，也有自己的日子）──
      yangcaiyun: {
        id: 'yangcaiyun', gender: 'female', home: 'goods_shop',
        name: '杨采云',
        role: '翟家货栈老板娘',
        location: 'street',
        goals: ['撑住翟家货栈的各路商道', '等一个能说心里话的知心相公'],
        secret: '结识南来北往的江南漕帮船帮头目，知晓各府奇珍异宝的进销行市',
        relations: {
          husband: { trust: 50, desire: 30, fear: 2, grievance: 8 },
        },
        intimacy: { level: 1, tone: 0, lastAt: 0, ritual: 'solemn' },
        schedule: [
          { at: 9, do: '来茶坊采办商茶', place: 'tea_house' },
          { at: 11, do: '回货栈料理生意', place: 'street' },
        ],
      },
      liuwenxia: {
        id: 'liuwenxia', gender: 'female', home: 'wine_shop', spouse: 'yujie',
        name: '刘文霞',
        role: '于家酒肆老板娘',
        location: 'street',
        goals: ['把自家酒肆的陈酿生意做大', '与王家相公常续红袖琴瑟之好'],
        secret: '私下密酿了一坛陈年女儿红，专等与心上人花前月下共饮',
        relations: {
          husband: { trust: 48, desire: 34, fear: 1, grievance: 10 },
        },
        intimacy: { level: 1, tone: 0, lastAt: 0, ritual: 'solemn' },
        schedule: [
          { at: 15, do: '来茶坊订茶包', place: 'tea_house' },
          { at: 17, do: '回酒肆看店', place: 'street' },
        ],
      },
      zhanjing: {
        id: 'zhanjing', gender: 'female', home: 'suijia_house',
        name: '静儿',
        role: '书吏发妻',
        location: 'suijia_house',
        goals: ['过好自家安稳日子', '得王相公照应免受市井胥吏欺凌'],
        secret: '手艺极巧，会做一手极地道的苏式点心和桂花清露',
        relations: {
          husband: { trust: 42, desire: 26, fear: 3, grievance: 14 },
        },
        intimacy: { level: 1, tone: 0, lastAt: 0, ritual: 'solemn' },
        schedule: [
          { at: 6, do: '在家操持家务', place: 'suijia_house' },
          { at: 10, do: '去慈云庵进香', place: 'temple' },
          { at: 14, do: '去市井茶摊置办针线', place: 'tea_stall' },
          { at: 18, do: '回随家小院歇息', place: 'suijia_house' },
        ],
      },
    },

    pending: [
      {
        id: 'qiantonghai_plot',
        desc: '钱通海在紫阳山设局，欲夺头春茶',
        due: 12,
        severity: 2,
        effects: [{ type: 'relation', target: 'waner', field: 'grievance', delta: 2 }],
      },
    ],

    promises: [],
    // 账本结构版本：升版本时把预设人物的日程/住处刷成最新设计（不影响用户自己造的 npc_*）
    stateVersion: 7,
    // 疆域：开遍全国要有个地图
    geo: {
      country: '大乾',
      capital: '京城',
      regions: [
        { name: '江南道', cities: ['临江府', '苏州府', '杭州府', '扬州府', '松江府'] },
        { name: '京畿道', cities: ['京城', '洛阳府', '汴梁府', '太原府'] },
        { name: '淮南道', cities: ['淮安府', '庐州府', '扬州府', '泰州府'] },
        { name: '河北道', cities: ['幽州府', '冀州府', '沧州府'] },
        { name: '岭南道', cities: ['广州府', '潮州府', '桂州府'] },
        { name: '剑南道', cities: ['成都府', '绵州府', '嘉州府'] },
        { name: '山东道', cities: ['济南府', '青州府', '登州府', '兖州府', '东昌府'] },
        { name: '河东道', cities: ['大同府', '平阳府', '蒲州府'] },
        { name: '关内道', cities: ['长安府', '凤翔府', '延安府'] },
        { name: '荆湖道', cities: ['江陵府', '潭州府', '襄阳府'] },
        { name: '河南道', cities: ['开封府', '南阳府', '归德府'] },
        { name: '辽东道', cities: ['辽阳府', '金州府', '开原府'] },
        { name: '陇右道', cities: ['兰州府', '凉州府', '秦州府'] },
        { name: '云贵道', cities: ['昆明府', '大理府', '贵阳府'] },
        { name: '闽浙道', cities: ['福州府', '泉州府', '温州府', '宁波府'] },
        { name: '江西道', cities: ['洪州府', '赣州府', '吉安府'] },
        { name: '淮北道', cities: ['徐州府', '宿州府'] },
      ],
    },
    // 山川河流：地形会真的影响守备与商路
    terrain: [
      { id: 'yangtze', name: '长江', kind: 'river', cities: ['临江府', '扬州府', '松江府', '江陵府', '潭州府'], note: '水路通天下，商船昼夜不绝' },
      { id: 'yellow', name: '黄河', kind: 'river', cities: ['开封府', '归德府', '徐州府', '济南府'], note: '屡屡决口，沿河州县十年九灾' },
      { id: 'grand_canal', name: '大运河', kind: 'canal', cities: ['临江府', '扬州府', '淮安府', '京城', '苏州府'], note: '漕运命脉，朝廷看得极紧' },
      { id: 'taihang', name: '太行山', kind: 'mountain', cities: ['大同府', '平阳府', '冀州府'], note: '山道险绝，一夫当关' },
      { id: 'qinling', name: '秦岭', kind: 'mountain', cities: ['长安府', '凤翔府', '秦州府'], note: '南北之界，翻山极难' },
      { id: 'taishan', name: '泰山', kind: 'mountain', cities: ['济南府', '兖州府'], note: '五岳之尊，天子封禅之地' },
      { id: 'shanhaiguan', name: '山海关', kind: 'pass', cities: ['辽阳府', '金州府'], note: '关外门户，失之则中原震动' },
      { id: 'jianmenguan', name: '剑门关', kind: 'pass', cities: ['绵州府', '嘉州府'], note: '蜀道之险，咽喉所在' },
      { id: 'dongting', name: '洞庭湖', kind: 'lake', cities: ['江陵府', '潭州府'], note: '水阔浪急，渔米之乡' },
      { id: 'boyang', name: '鄱阳湖', kind: 'lake', cities: ['洪州府', '赣州府'], note: '鱼米丰足，亦多水患' },
    ],

    // 朝廷：官职（可被杀、可被顶替）与律法
    court: {
      emperor: '乾宁帝',
      offices: {
        chancellor: { title: '当朝宰相', holder: 'cuiyuanli', vacant: false },
        revenue: { title: '户部尚书', holder: 'luchengye', vacant: false },
        war: { title: '兵部尚书', holder: 'hanchong', vacant: false },
        governor: { title: '江南巡抚', holder: 'zhenghuaian', vacant: false },
        prefect: { title: '临江知府', holder: 'yangshenzhi', vacant: false },
      },
      // 天意：皇帝是什么人、天道允不允许动他
      mandate: {
        quality: 'benevolent_deceived', // 仁君·被蒙蔽
        note: '一心想着赈济天下，银子却一层层被官员剥走，到百姓手里所剩无几',
        wrath: false,                    // 天道是否已降罚
      },
      // 待决之事（杀不杀皇帝，得先让人知道真相）
      decisions: [],
      law: {
        murder: '杀人者死',
        taxCap: 30,
        rebel: '谋逆者诛族',
        smuggle: '私盐者杖一百、流三千里',
      },
    },
    // 各人的私房钱：产业归谁，钱就进谁的口袋
    wallets: {},
    // 名声与通缉：士绅口碑 / 官府悬赏
    reputation: 50,
    wanted: 0,
    // 天下势力：朝廷、藩镇、义军、商帮、山匪
    // ── 行会：同行的规矩，不是朝廷立的，是行里人自己立的 ──
    guilds: {
      chahang: { id: 'chahang', name: '茶行', head: 'qiantonghai', headName: '钱通海', dues: 4, power: 60, note: '茶价由茶行说了算，不入行的茶卖不上价' },
      caobang: { id: 'caobang', name: '漕帮', head: '', headName: '雷七', dues: 3, power: 75, note: '码头水运都归漕帮，过船要交例钱' },
      tuhang: { id: 'tuhang', name: '屠行', head: 'zhangtu', headName: '张屠户', dues: 2, power: 30, note: '肉案的价格与地盘' },
      xiuhang: { id: 'xiuhang', name: '绣行', head: '', headName: '苏娘', dues: 2, power: 25, note: '绣活派给谁，由绣行分' },
      yahang: { id: 'yahang', name: '牙行', head: 'danglaoban', headName: '曹当', dues: 5, power: 40, note: '买卖居间、当铺赎当都过牙行' },
    },

    // ── 邻国：中原之外，还有别人 ──
    foreign: {
      beidi: { id: 'beidi', name: '北狄', relation: 45, army: 800, kind: '游牧', wants: '绢帛与铁器' },
      nanzhao: { id: 'nanzhao', name: '南诏', relation: 60, army: 400, kind: '山地', wants: '盐与茶' },
      dongying: { id: 'dongying', name: '东瀛', relation: 55, army: 200, kind: '海邦', wants: '书籍与瓷器' },
    },

    powers: {
      court: { name: '大乾朝廷', kind: '朝廷', power: 90, relation: 0, troops: 200000, note: '名义上统御天下' },
      wangjia: { name: '王家', kind: '商帮', power: 5, relation: 100, troops: 0, note: '你自己', ownerActor: 'husband' },
    },
    // 城池：谁占着、守备多少、富不富、民心稳不稳
    cities: {},
    // 盟友：合兵打仗用
    allies: {},
    // 各人的兵力（真人各自起兵，互不隶属）；丈夫用 military 这一份
    forces: {},
    // 兵力：私兵→乡勇→起义军，一步一步
    military: {
      guards: 0,       // 护院家丁
      militia: 0,      // 乡勇团练
      army: 0,         // 正式兵马
      quality: 20,     // 训练度
      morale: 50,      // 士气
      supplies: 0,     // 粮草（日）
    },
    // 基础设施：像现实社会一样，得一点点建
    infra: {
      roads: 0,        // 道路（影响商队与行军）
      granary: 0,      // 粮仓（支撑军队）
      dock: 0,         // 码头（水运与漕帮）
      workshop: 0,     // 匠作坊（军械）
      school: 0,       // 学堂（人才）
      clinic: 0,       // 药堂（伤病）
    },
    // 公历锚点：世界第 N 日 = anchorDate + (N - anchorDay) 天
    calendar: { anchorDay: 1, anchorDate: '' },
    // 势力与声望：复仇、翻案、朝堂线都靠它记账
    factions: {
      yamen: { name: '临江府衙', relation: 0, power: 45 },
      court: { name: '朝廷权贵', relation: -10, power: 90 },
      canal: { name: '运河漕帮', relation: 0, power: 35 },
    },
    // 线索：翻案复仇要一条条攒
    clues: [],
    // 长期记忆：值得她记一辈子的事（不受对话历史上限影响）
    memories: [],
    // 约定：约好某日某时要发生的事（如「后天晌午刘文霞来找相公」）
    appointments: [],
    // 天道主动推送队列：不用主人开口，世界自己找上门
    proactive: [],
    milestones: completed,

    flags: {
      canalRestaurantBought: true,
      eventSeq: 0,
      npcSeq: 0,
      lastMorningReport: 0,
      receiptRounds: 0,
      receiptHits: 0,
      recentReceipts: [],
      lastProactiveAt: 0,
      lastUserMessageAt: 0,
    },
  };
}

/** 修正历史遗留的「林芸娘处 / 林芸娘廊下」这类怪地名 → 统一成后院暖阁·东厢 */
function normalizePlaces(places, actorsLive) {
  const actors = actorsLive || {};
  for (const p of Object.values(places || {})) {
    let nm = String(p?.name || '');
    // 历史遗留：「地点·雅阁」这种把格式词当地名了
    nm = nm.replace(/^(地点|场景|场所|时空)[·・]/, '');
    if (nm && p && p.name !== nm) p.name = nm;
    const m = /^([\u4e00-\u9fa5]{2,4})(处|廊下|房里|屋|房)$/.exec(nm);
    if (!m) continue;
    const who = Object.values(actors || {}).find(
      (a) => a?.name && (a.name === m[1] || a.name.endsWith(m[1])),
    );
    if (who) p.name = '后院暖阁·东厢';
  }
  // 归一之后可能出现重名 → 保留第一个，其余把人物迁过去并删掉
  const byName = new Map();
  for (const [id, p] of Object.entries(places || {})) {
    const nm = String(p?.name || '');
    if (!nm) continue;
    if (!byName.has(nm)) {
      byName.set(nm, id);
      continue;
    }
    const keepId = byName.get(nm);
    for (const a of Object.values(actors)) {
      if (a && a.location === id) a.location = keepId;
    }
    delete places[id];
  }
  return places;
}

const CN_DIGIT = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function cnDay(n) {
  n = Number(n) || 1;
  if (n <= 10) return '初' + CN_DIGIT[n];
  if (n < 20) return '十' + CN_DIGIT[n - 10];
  if (n === 20) return '二十';
  if (n < 30) return '廿' + CN_DIGIT[n - 20];
  if (n === 30) return '三十';
  return String(n);
}
function cnMonth(n) {
  n = Number(n) || 1;
  if (n === 1) return '正月';
  if (n <= 10) return CN_DIGIT[n] + '月';
  if (n === 11) return '十一月';
  if (n === 12) return '十二月';
  return n + '月';
}

/** 公历 Date → 农历（用系统 ICU，零依赖、够准）*/
export function lunarOf(date) {
  // 优先用自带表（软路由 ICU 精简，Intl 会静默退回公历）
  const fromTable = lunarFromTable(date);
  if (fromTable) {
    return { month: cnMonth(fromTable.month), day: cnDay(fromTable.day), text: `${cnMonth(fromTable.month)}${cnDay(fromTable.day)}` };
  }
  try {
    const fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'numeric', day: 'numeric' });
    const parts = fmt.formatToParts(date);
    const mo = Number(parts.find((p) => p.type === 'month')?.value);
    const da = Number(parts.find((p) => p.type === 'day')?.value);
    if (!mo || !da) return null;
    return { month: cnMonth(mo), day: cnDay(da), text: `${cnMonth(mo)}${cnDay(da)}` };
  } catch {
    return null;
  }
}

/** 世界第 N 日对应公历哪一天；没设锚点就返回 null */
export function worldDate(world) {
  const cal = world?.calendar || {};
  if (!cal.anchorDate) return null;
  const anchor = new Date(`${cal.anchorDate}T00:00:00`);
  if (Number.isNaN(anchor.getTime())) return null;
  const diff = (Number(world.clock?.day) || 1) - (Number(cal.anchorDay) || 1);
  anchor.setDate(anchor.getDate() + diff);
  const iso = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}`;
  const lunar = lunarOf(anchor);
  return { iso, month: anchor.getMonth() + 1, day: anchor.getDate(), year: anchor.getFullYear(), lunar };
}

const REGION_WEALTH = {
  江南道: 70, 京畿道: 65, 淮南道: 55, 河北道: 40, 岭南道: 45, 剑南道: 60,
  山东道: 55, 河东道: 45, 关内道: 50, 荆湖道: 50, 河南道: 55, 辽东道: 25,
  陇右道: 30, 云贵道: 25, 闽浙道: 65, 江西道: 45, 淮北道: 40,
};

const CITY_GOODS = {
  临江府: ['茶', '米'],
  苏州府: ['丝', '绣'],
  杭州府: ['绸', '茶'],
  扬州府: ['盐', '布'],
  松江府: ['棉', '布'],
  京城: ['官盐', '铁器'],
  洛阳府: ['粮', '马'],
  汴梁府: ['粮', '纸'],
  太原府: ['铁', '煤'],
  淮安府: ['盐', '漕粮'],
  庐州府: ['米', '木'],
  泰州府: ['盐', '鱼'],
  幽州府: ['马', '铁'],
  冀州府: ['粮', '绢'],
  沧州府: ['盐', '铁'],
  广州府: ['香料', '糖'],
  潮州府: ['瓷', '茶'],
  桂州府: ['药', '木'],
  成都府: ['锦', '茶'],
  绵州府: ['粮', '漆'],
  嘉州府: ['竹', '纸'],
  济南府: ['盐', '铁'],
  青州府: ['丝', '粮'],
  登州府: ['鱼', '盐'],
  兖州府: ['粮', '布'],
  东昌府: ['棉', '马'],
  大同府: ['马', '铁'],
  平阳府: ['煤', '铁'],
  蒲州府: ['盐', '粮'],
  长安府: ['粮', '丝'],
  凤翔府: ['铁', '马'],
  延安府: ['马', '皮'],
  江陵府: ['米', '鱼'],
  潭州府: ['茶', '木'],
  襄阳府: ['粮', '铁'],
  开封府: ['粮', '纸'],
  南阳府: ['铁', '药'],
  归德府: ['粮', '棉'],
  辽阳府: ['马', '皮'],
  金州府: ['鱼', '盐'],
  开原府: ['马', '木'],
  兰州府: ['皮', '盐'],
  凉州府: ['马', '铁'],
  秦州府: ['铁', '木'],
  昆明府: ['铜', '茶'],
  大理府: ['马', '药'],
  贵阳府: ['木', '药'],
  福州府: ['茶', '瓷'],
  泉州府: ['香料', '瓷'],
  温州府: ['漆', '木'],
  宁波府: ['鱼', '布'],
  洪州府: ['瓷', '粮'],
  赣州府: ['木', '纸'],
  吉安府: ['粮', '纸'],
  徐州府: ['铁', '粮'],
  宿州府: ['粮', '布'],
};

/** 按疆域把每座城建出来（只在缺的时候建，不覆盖已有归属）*/
/** 朝中大员：没有就补上，死了不复活（位置空着等人顶上）*/
/** 给每个府的父母官起个像人的名字（同一座城名字固定）*/
function cityOfficialName(cityName) {
  const surnames = ['周', '吴', '郑', '王', '李', '赵', '孙', '钱', '冯', '陈', '韩', '朱', '秦', '许', '何', '吕', '施', '张', '孔', '曹'];
  const given = ['文远', '守正', '承先', '敬之', '伯安', '仲平', '子敬', '元朗', '季常', '叔达', '汝霖', '子昂', '公度', '伯远'];
  let h = 0;
  for (const ch of String(cityName)) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return surnames[h % surnames.length] + given[Math.floor(h / 7) % given.length];
}

/** 给某座城建一个府衙地点，返回 placeId */
function ensureGovPlace(world, cityName) {
  world.places = world.places || {};
  const pid = `gov_${cityName}`;
  if (!world.places[pid]) {
    world.places[pid] = { name: `${cityName}府衙`, exits: ['street'], owner: 'court', dynamic: false };
  }
  return pid;
}

/** 给官员起一个像人的名字：姓 + 名（按种子稳定生成，不会每轮变）*/
export function makeOfficialName(seed, fixedSurname = null) {
  const SURNAMES = ['王','李','张','刘','陈','杨','赵','周','吴','徐','孙','马','朱','胡','郭','何','高','林','罗','郑','梁','谢','宋','唐','许','韩','冯','邓','曹','彭','曾','萧','田','董','袁','潘','蔡','蒋','余','杜'];
  const GIVEN = ['元芳','守正','文远','子昂','敬之','国维','怀安','允升','秉忠','士诚','廷玉','孟春','仲元','季常','景行','德昭','仁甫','克明','承宗','明远','守拙','念祖','敬修','文正','思远','茂才','志学','允恭','克勤','清和'];
  const key = String(seed || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 131 + key.charCodeAt(i)) >>> 0;
  const sn = fixedSurname || SURNAMES[h % SURNAMES.length];
  const gv = GIVEN[(h >>> 7) % GIVEN.length];
  return { name: `${sn}${gv}`, surname: sn };
}

/** 按身份给一笔起步私房钱（两）；已有钱的人不动 */
export function seedPersonalMoney(world) {
  const MONEY = {
    掌柜: [8, 30], 东家: [15, 40], 郎中: [4, 12], 镖头: [3, 10], 先生: [2, 6], 夫子: [2, 6],
    知县: [5, 20], 知府: [15, 40], 尚书: [40, 80], 宰相: [80, 150], 天子: [200, 500],
    伙计: [0.5, 2], 小二: [0.5, 2], 小厮: [0.3, 1.5], 丫鬟: [0.3, 1.5], 丫头: [0.3, 1.5],
    妇人: [1, 5], 寡妇: [1, 4], 绣娘: [0.8, 3], 农: [0.3, 1.5], 娘: [1, 5], 婆: [0.5, 2],
  };
  let seeded = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (typeof a.money === 'number') continue;
    const role = String(a.role || '');
    let base = [0.8, 3];
    for (const k of Object.keys(MONEY)) {
      if (role.includes(k)) { base = MONEY[k]; break; }
    }
    const rnd = (a.id || a.name || '').split('').reduce((h, c) => (h * 131 + c.charCodeAt(0)) >>> 0, 7) / 4294967295;
    a.money = Math.round((base[0] + (base[1] - base[0]) * rnd) * 100) / 100;
    seeded += 1;
  }
  if (seeded) console.log(`[Money] 给 ${seeded} 人补了私房钱`);
  return seeded;
}


/** 给女性播种月事周期（28 天一轮，行经 4~6 天）*/
export function seedMenses(world) {
  const day = Number(world.clock?.day) || 1;
  let seeded = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.gender !== 'female') continue;
    if (a.menses && typeof a.menses.cycleDay === 'number') continue;
    const age = Number(a.age) || 24;
    if (age < 13 || age > 52) continue;
    const h = String(a.id || a.name || '').split('').reduce((x, c) => (x * 131 + c.charCodeAt(0)) >>> 0, 11);
    a.menses = {
      cycle: 28,
      periodLen: 4 + (h % 3),           // 4~6 天
      cycleDay: h % 28,                  // 起始点错开
      sinceDay: day,
    };
    seeded += 1;
  }
  if (seeded) console.log(`[Menses] 给 ${seeded} 位女性播种月事周期`);
  return seeded;
}

export function ensureCourt(world) {
  try {
    // 查明紫嫣名义上的丈夫（于子归/于杰，无论id是npc_2还是yujie）
    let yujieActor = Object.values(world.actors || {}).find((a) => a && !a.dead && /于子归|于杰/.test(a.name || ''));
    if (yujieActor) {
      yujieActor.home = 'wine_shop';
      yujieActor.spouse = 'liuwenxia';
      if (!Array.isArray(yujieActor.schedule) || yujieActor.schedule.length === 0) {
        yujieActor.schedule = [
          { at: 7, do: '去长街承揽土木活计', place: 'street' },
          { at: 12, do: '在街边面摊用饭歇脚', place: 'noodle_stall' },
          { at: 18, do: '回于家酒肆收工歇脚', place: 'wine_shop' },
          { at: 22, do: '在酒肆后院安歇', place: 'wine_shop' },
        ];
      }
      if (world.actors?.liuwenxia) {
        world.actors.liuwenxia.spouse = yujieActor.id;
      }
    } else {
      if (world.actors?.liuwenxia && !world.actors.liuwenxia.spouse) world.actors.liuwenxia.spouse = 'yujie';
      if (world.actors?.yujie && !world.actors.yujie.spouse) world.actors.yujie.spouse = 'liuwenxia';
    }
    // 物理空间解耦自愈：非王府同住内宅女眷，绝不滞留在正房寝居或后院私宅
    for (const [aId, a] of Object.entries(world.actors || {})) {
      if (!a || a.dead || a.id === 'husband') continue;
      const isInner = ['husband_room', 'backyard'].includes(a.location);
      const isHousehold = a.household || ['waner', 'yunnia', 'xiaocui'].includes(aId);
      if (isInner && !isHousehold) {
        a.location = (a.home && world.places?.[a.home]) ? a.home : 'wine_shop';
      }
    }
  } catch (_) {}
  world.court = world.court || {};
  world.court.offices = world.court.offices || {};
  const seed = [
    ['emperor', '萧景隆', '当朝天子', 'emperor', '京城'],
    ['cuiyuanli', '崔元礼', '当朝宰相', 'chancellor', '京城'],
    ['luchengye', '卢承业', '户部尚书', 'revenue', '京城'],
    ['hanchong', '韩崇', '兵部尚书', 'war', '京城'],
    ['zhenghuaian', '郑怀安', '江南巡抚', 'governor', '苏州府'],
    ['yangshenzhi', '杨慎之', '临江知府', 'prefect', '临江府'],
  ];
  // 每个府都要有父母官，不然攻城就是打空城
  for (const cityName of Object.keys(world.cities || {})) {
    const post = `city:${cityName}`;
    if (world.court.offices[post]) continue;
    const id = `off_${cityName}`;
    if (!world.actors[id]) {
      const baseName = cityOfficialName(cityName);
      const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
      let offName = baseName;
      const sufO = ['', '二', '三', '四'];
      for (let i = 0; i < sufO.length && usedNames.has(offName); i += 1) offName = baseName + sufO[i];
      world.actors[id] = {
        id,
        name: offName,
        role: `${cityName}知府`,
        gender: 'male',
        kind: 'official',
        office: post,
        household: false,
        home: 'yamen',
        location: 'yamen',
        relations: { husband: { trust: 15, desire: 0, fear: 0, grievance: 0 } },
        goals: [`守住${cityName}`, '别让上头挑出错处'],
        secret: '任上收过几笔常例',
        schedule: [],
      };
    }
    const govPlace = ensureGovPlace(world, cityName);
    const offActor = world.actors[id];
    if (offActor && (!offActor.location || offActor.location === 'yamen')) {
      offActor.location = govPlace;
      offActor.home = govPlace;
    }
    world.court.offices[post] = { title: `${cityName}知府`, holder: id, vacant: false, city: cityName };
  }

  for (const [id, name, role, post, city] of seed) {
    if (!world.actors) world.actors = {};
    if (!world.actors[id]) {
      world.actors[id] = {
        id,
        name,
        role: `${role}（${city}）`,
        gender: /夫人|娘|女/.test(role) ? 'female' : 'male',
        kind: 'official',
        office: post,
        household: false,
        home: ensureGovPlace(world, city),
        location: ensureGovPlace(world, city),
        relations: { husband: { trust: 20, desire: 0, fear: 0, grievance: 0 } },
        goals: id === 'emperor'
          ? ['压住江南的乱象', '把兵权收回来', '看这几个老臣谁先动']
          : id === 'yangshenzhi'
            ? ['给采儿定一门体面的亲事', '坐稳临江知府这位子']
            : [`坐稳${post}这位子`, '看清朝中风向'],
        secret: id === 'emperor' ? '身子骨早就不行了，怕的是有人先动手' : (id === 'yangshenzhi' ? '拿女儿的亲事换官场上的路' : '府里上下都收过银子'),
        schedule: [],
      };
    }
    const off = world.court.offices[post];
    if (!off) world.court.offices[post] = { title: role, holder: id, vacant: false };
  }
  // 老存档迁移：朝官（天子/宰相/尚书/巡抚/知府）回到各自的城
  const seedCity = {
    emperor: '京城', chancellor: '京城', revenue: '京城', war: '京城',
    governor: '苏州府', prefect: '临江府',
  };
  for (const [id, cityName] of Object.entries(seedCity)) {
    const actor = world.actors?.[id];
    if (!actor) continue;
    if (actor.location && actor.location !== 'yamen') continue;
    const govPlace = ensureGovPlace(world, cityName);
    actor.location = govPlace;
    actor.home = govPlace;
  }

  // 老存档迁移：已经存在的各府官员，别都挤在临江县衙
  for (const [post, off] of Object.entries(world.court.offices || {})) {
    if (!post.startsWith('city:') || !off?.holder) continue;
    const cityName = post.slice(5);
    const govPlace = ensureGovPlace(world, cityName);
    const actor = world.actors?.[off.holder];
    if (actor && actor.location === 'yamen') {
      actor.location = govPlace;
      actor.home = govPlace;
    }
  }

  // 每城补知县（独立于官职是否已存在）
  try {
    for (const cityName of Object.keys(world.cities || {})) {
      const countyId = `county_${cityName}`;
      if (world.actors?.[countyId]) continue;
      const govPlace = ensureGovPlace(world, cityName);
      let countyName = makeOfficialName(cityName).name;
      // 重名就再取一个（最多试 8 次）
      for (let attempt = 0; attempt < 8; attempt++) {
        const clash = Object.values(world.actors || {}).some((x) => x && x.name === countyName);
        if (!clash) break;
        countyName = makeOfficialName(cityName + '#' + attempt + '#' + countyId).name;
      }
      world.actors = world.actors || {};
      world.actors[countyId] = {
        id: countyId, name: countyName, role: `${cityName}知县`, gender: 'male',
        home: govPlace, location: govPlace, origin: 'preset',
        goals: ['三年考满'], relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } },
        schedule: [{ at: 9, do: '升堂理事', place: govPlace }],
      };
    }
  } catch { /* 忽略 */ }

  return world.court;
}

/** 山河落地：关隘加守备、水运加富庶（只加一次，用 flag 记着）*/
export function ensureTerrain(world) {
  world.terrain = Array.isArray(world.terrain) ? world.terrain : [];
  world.flags = world.flags || {};
  if (world.flags.terrainApplied) return world.terrain;
  for (const t of world.terrain) {
    for (const cn of t.cities || []) {
      const ct = world.cities?.[cn];
      if (!ct) continue;
      if (t.kind === 'pass') ct.defense = Math.round((Number(ct.defense) || 10) * 1.3);
      if (t.kind === 'mountain') ct.defense = Math.round((Number(ct.defense) || 10) * 1.15);
      if (t.kind === 'river' || t.kind === 'canal') ct.wealth = Math.round((Number(ct.wealth) || 40) * 1.1);
      if (t.kind === 'lake') ct.wealth = Math.round((Number(ct.wealth) || 40) * 1.05);
    }
  }
  world.flags.terrainApplied = true;
  return world.terrain;
}

export function ensureCities(world) {
  world.cities = world.cities && typeof world.cities === 'object' ? world.cities : {};
  // 水运枢纽：一次性打上 port 标记（此后只认字段，不再靠名字猜）
  try {
    world.flags = world.flags || {};
    if (!world.flags.portBackfillDone) {
      let marked = 0;
      for (const [cityName, ct] of Object.entries(world.cities || {})) {
        if (!ct) continue;
        if (ct.port === undefined) {
          ct.port = /(运河|码头|水运|江南|淮|漕|临江)/.test(`${cityName} ${ct.region || ''}`);
          if (ct.port) marked += 1;
        }
      }
      world.flags.portBackfillDone = { day: world.clock?.day || 1, marked };
      if (marked) console.log(`[City] 标记 ${marked} 座水运枢纽城（port=true）`);
    }
  } catch { /* 忽略 */ }
  const regions = world.geo?.regions || [];
  for (const r of regions) {
    for (const name of r.cities || []) {
      if (world.cities[name]) continue;
      world.cities[name] = {
        region: r.name,
        owner: 'court',
        defense: 15 + Math.floor(Math.random() * 15),
        wealth: Math.max(10, Math.round(((REGION_WEALTH[r.name] || 45) + (Math.random() * 20 - 10)) * 10) / 10),
        unrest: 5 + Math.floor(Math.random() * 15),
        goods: CITY_GOODS[name] || [],
        price: 100,   // 物价指数，100 为常价
        tax: 10,      // 税率 %
      };
    }
  }
  return world.cities;
}

/**
 * 势力阶梯：你现在算老几
 * 由 名声 + 兵力 + 城池 + 势力值 决定，不写死剧情。
 */
export function standingOf(world) {
  const rep = Number(world?.reputation) || 0;
  const mil = world?.military || {};
  const troops = (Number(mil.guards) || 0) + (Number(mil.militia) || 0) + (Number(mil.army) || 0);
  const cities = Object.values(world?.cities || {}).filter((c) => c?.owner === 'wangjia').length;
  const power = Number(world?.powers?.wangjia?.power) || 0;
  const score = rep * 1.0 + troops * 0.05 + cities * 15 + power * 1.5;

  const ladder = [
    { at: 0, name: '无名之辈', note: '没人把你放在眼里' },
    { at: 40, name: '一坊富户', note: '街面上有人打招呼' },
    { at: 80, name: '临江乡绅', note: '县衙递帖子要先问你一句' },
    { at: 150, name: '一方豪强', note: '护院成群，官府开始盯你' },
    { at: 260, name: '义军首领', note: '有人愿意跟着你卖命' },
    { at: 420, name: '割据诸侯', note: '朝廷把你写进邸报' },
    { at: 650, name: '问鼎天下', note: '你的名字开始改朝换代' },
  ];
  let cur = ladder[0];
  let next = null;
  for (let i = 0; i < ladder.length; i++) {
    if (score >= ladder[i].at) cur = ladder[i];
    else { next = ladder[i]; break; }
  }
  return { score: Math.round(score), level: cur.name, note: cur.note, next: next ? { name: next.name, at: next.at } : null };
}

/** 取某个人的兵力账（丈夫用 military，其余人用 forces[id]）*/
export function forceOf(world, who = 'husband') {
  if (!who || who === 'husband') return (world.military = world.military || { guards: 0, militia: 0, army: 0, quality: 20, morale: 50, supplies: 0 });
  world.forces = world.forces || {};
  if (!world.forces[who]) {
    world.forces[who] = { guards: 0, militia: 0, army: 0, quality: 20, morale: 50, supplies: 0 };
  }
  return world.forces[who];
}

/** 老存档补归属：地点/势力/线索没写主人的，按预设补上，别让自检一直报无主 */
export function migrateOwnership(world) {
  // 官府衙署层级化：照壁/大堂/二堂/花厅/大牢/校场（幂等）
  try {
    const n = buildCourts(world);
    if (n) { console.log(`[Court] 建出 ${n} 间衙署房舍`); world.__migratedDirty = true; }
  } catch { /* 忽略 */ }

  // 经营场所立体化：三层酒楼、前店后坊、茶坊雅间（只建有主的，幂等）
  try {
    const n = buildPremises(world);
    if (n) { console.log(`[Premises] 建出 ${n} 间经营空间`); world.__migratedDirty = true; }
  } catch { /* 忽略 */ }

  // 流动小贩归位：卖花女/货郎不许寄居在别人宅子里
  try {
    const n = settleItinerants(world);
    if (n) { console.log(`[Residence] 把 ${n} 个流动小贩请回街市`); world.__migratedDirty = true; }
  } catch { /* 忽略 */ }

  // 一次性：粮价基数归位（明末江南丰年一石约四钱）
  try {
    world.flags = world.flags || {};
    if (!world.flags.priceBaseFixV1) {
      world.market = world.market || {};
      if (world.market.grain) world.market.grain.base = 0.4;
      world.flags.priceBaseFixV1 = { day: world.clock?.day || 1 };
      console.log('[Price] 粮价基数归位 0.4 两/石');
    }
  } catch { /* 忽略 */ }

  // 一次性：清掉"几个铺子/若干铺"这类被量词骗出来的假产业
  try {
    world.flags = world.flags || {};
    if (!world.flags.propertyCleanupV2) {
      const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
      const before = props.length;
      const bad = [];
      world.assets.properties = props.filter((p) => {
        const nm = String(p?.name || '');
        const fake = /^(几个|若干|多家|一些|这一个|那一个|某|好多|数个|几间|几处)/.test(nm);
        if (fake) bad.push(nm);
        return !fake;
      });
      world.flags.propertyCleanupV2 = { removed: before - world.assets.properties.length };
      if (bad.length) console.log(`[Property] 清掉假产业：${bad.join('、')}`);
    }
  } catch { /* 忽略 */ }

  // 空间清理（串模板房间 / 小贩归位 / 补房间 / 门路）：同一进程内最多每 60 秒跑一次，
  // 不然每次读档都扫一千多个地点，接口会被拖慢
  try {
    const now = Date.now();
    if (now - (globalThis.__spaceSweptAt || 0) > 60000) {
      globalThis.__spaceSweptAt = now;
      // 住户按位份归位（正妻正房、二房东厢、丫鬟下房…）
      try {
        for (const [pid, pl] of Object.entries(world.places || {})) {
          if (pl && pl.rooms) {
            assignStaffQuarters(world, pid);
            if (pl.residence) {
              const g = ensureGatekeeper(world, pid);
              if (g && !g.ok) console.log(`[Duty] ${pid} 没有门房：${g.reason}`);
            }
          }
        }
      } catch { /* 忽略 */ }
      // 城市基底：先把大城铺一遍（幂等，只做一次），外城才有人可打交道
      try {
        if (!world.flags?.cityBaseAllV1) {
          const n = ensureAllCityBases(world);
          world.flags = world.flags || {};
          world.flags.cityBaseAllV1 = { at: Date.now(), cities: n };
          console.log(`[City] 全城基底已铺：${n} 座城`);
        }
      } catch { /* 忽略 */ }

      // 城市基底：有人在外城，就先把那座城铺出来（幽州试点）
      try {
        const cityNeeded = new Set();
        for (const a of Object.values(world.actors || {})) {
          if (!a || a.dead) continue;
          const pn = String(world.places?.[a.location]?.name || '');
          const m = pn.match(/^([\u4e00-\u9fa5]{2,3}?)(府|州|县)/);
          if (m) cityNeeded.add(m[1] + m[2]);
        }
        for (const cn of cityNeeded) {
          if (!world.cities?.[cn]) continue;
          ensureCityBase(world, cn);
        }
      } catch { /* 忽略 */ }
      // 一次性：官场人物（off_/county_）重名，同样加辈字改正
      try {
        if (!world.flags?.nameDedupeV4) {
          const keep = new Set();
          const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);
          all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
          const renamed = [];
          for (const a of all) {
            if (!keep.has(a.name)) { keep.add(a.name); continue; }
            if (!/^off_|^county_/.test(String(a.id))) continue;
            const base = a.name;
            const suf = ['二', '三', '四', '五'];
            let nm = base;
            for (let i = 0; i < suf.length && keep.has(nm); i += 1) nm = base + suf[i];
            if (keep.has(nm)) continue;
            renamed.push(`${base}→${nm}`);
            a.name = nm;
            keep.add(nm);
          }
          world.flags = world.flags || {};
          world.flags.nameDedupeV4 = { at: Date.now(), renamed: renamed.length };
          if (renamed.length) console.log(`[Name] 官员重名改正 ${renamed.length} 人：${renamed.join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：仍有重名（含撞名再撞名）——加辈字改正
      try {
        if (!world.flags?.nameDedupeV3) {
          const keep = new Set();
          const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);
          all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
          const renamed = [];
          for (const a of all) {
            if (!keep.has(a.name)) { keep.add(a.name); continue; }
            if (a.id === 'husband' || String(a.id).startsWith('usr_')) continue;
            const base = a.name;
            let n = 0;
            let nm = base;
            const suf = ['二', '三', '四', '五', '六', '七', '八', '九', '十'];
            while (keep.has(nm) && n < suf.length) { nm = base + suf[n]; n += 1; }
            if (keep.has(nm)) continue;
            renamed.push(`${base}→${nm}`);
            a.name = nm;
            keep.add(nm);
          }
          world.flags = world.flags || {};
          world.flags.nameDedupeV3 = { at: Date.now(), renamed: renamed.length };
          if (renamed.length) console.log(`[Name] 残留重名改正 ${renamed.length} 人：${renamed.slice(0, 8).join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：全服重名改正（同名只留一个，其余换世界姓名池里的名字，id 不动）
      try {
        if (!world.flags?.nameDedupeV2) {
          const keep = new Set();
          const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);
          all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
          const renamed = [];
          for (const a of all) {
            if (!keep.has(a.name)) { keep.add(a.name); continue; }
            if (a.id === 'husband' || String(a.id).startsWith('usr_')) continue;
            let nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            for (let i = 0; i < 8 && nm && keep.has(nm); i += 1) nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            if (!nm) continue;
            // 还是撞名就加辈字，保证真的不重
            let suffix = 0;
            const baseNm = nm;
            while (keep.has(nm)) { suffix += 1; nm = baseNm + ['二', '三', '四', '五', '六', '七', '八', '九'][suffix - 1] || (baseNm + suffix); if (suffix > 9) break; }
            renamed.push(`${a.name}→${nm}`);
            a.name = nm;
            keep.add(nm);
          }
          world.flags = world.flags || {};
          world.flags.nameDedupeV2 = { at: Date.now(), renamed: renamed.length };
          if (renamed.length) console.log(`[Name] 全服重名改正 ${renamed.length} 人：${renamed.slice(0, 8).join('、')}…`);
        }
      } catch { /* 忽略 */ }

      // 一次性：府内名分与住处对齐（正妻正房、侧室东厢、丫鬟下房）
      try {
        if (!world.flags?.innerRankFixV1) {
          const east = Object.keys(world.places || {}).find((id) => /mansion_east/.test(id));
          const west = Object.keys(world.places || {}).find((id) => /mansion_west|servant_utility/.test(id));
          const fixed = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const role = String(a.role || '');
            if (/正妻/.test(role) && world.places?.husband_room) {
              a.home = 'husband_room';
              a.location = 'husband_room';
            } else if (/如夫人|二房|侧室|妾|姨娘|通房/.test(role) && east) {
              a.home = east; a.location = east; fixed.push(a.name);
            } else if (/丫鬟|丫头/.test(role) && west) {
              a.home = west; a.location = west; fixed.push(a.name);
            }
          }
          world.flags = world.flags || {};
          world.flags.innerRankFixV1 = { at: Date.now(), fixed };
          if (fixed.length) console.log(`[Rank] 内眷归位：${fixed.join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 天亮归位：只解禁当夜，第二天自动回端庄
      try {
        const dayNow = Number(world.clock?.day) || 1;
        for (const a of Object.values(world.actors || {})) {
          if (!a?.intimacy?.consentedDay) continue;
          if (Number(a.intimacy.consentedDay) === dayNow) continue;
          a.intimacy.ritual = 'solemn';
          a.intimacy.tone = 0;
          delete a.intimacy.consentedDay;
        }
      } catch { /* 忽略 */ }

      // 一次性：清掉被误立成产业的客房/上房
      try {
        if (!world.flags?.roomPropFixV1) {
          const before = (world.assets?.properties || []).length;
          world.assets.properties = (world.assets.properties || []).filter((p) => !(p && /上房|客房|房间|厢房|卧房|雅间/.test(String(p.name || ''))));
          const removed = before - world.assets.properties.length;
          world.flags = world.flags || {};
          world.flags.roomPropFixV1 = { at: Date.now(), removed };
          if (removed) console.log(`[Property] 清掉误立的客房产业：${removed} 处`);
        }
      } catch { /* 忽略 */ }

      // 一次性：所有城的铺面配人      // 一次性：所有城的铺面配人（掌柜/跑堂/伙计/摊主）
      try {
        if (!world.flags?.shopStaffV1) {
          let n = 0;
          for (const cn of Object.keys(world.flags?.cityBase || {})) {
            try { n += ensureShopStaff(world, cn); } catch { /* 忽略 */ }
          }
          world.flags = world.flags || {};
          world.flags.shopStaffV1 = { at: Date.now(), n };
          console.log(`[Shop] 全城铺面配人：${n} 名`);
        }
      } catch { /* 忽略 */ }

      // 一次性：错挂到王宅的丫鬟/婆子，按出身改回本处
      try {
        if (!world.flags?.servantHomeFixV1) {
          let fixed = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const homeName = String(world.places?.[a.home]?.name || '');
            if (!homeName.startsWith('临江·王宅')) continue;
            if (String(a.spouse || '') === 'husband') continue;
            if (/正妻|如夫人|二房|侧室|妾|通房/.test(String(a.role || ''))) continue;
            if (String(a.id) === 'xiaocui') continue;
            if (a.household) continue;
            // 按 id 推本家：临江_servant_1_0 → 临江_estate_1
            const m = String(a.id).match(/^(.+?)_(?:servant|gentry)_(\d+)/);
            const estate = m ? `${m[1]}_estate_${m[2]}` : null;
            if (estate && world.places?.[estate]) {
              a.home = estate;
            } else {
              // 铺面当差的：住处跟铺面；其余就算街坊
              const loc = world.places?.[a.location];
              a.home = loc && loc.residence ? a.location : 'street';
            }
            fixed += 1;
          }
          world.flags = world.flags || {};
          world.flags.servantHomeFixV1 = { at: Date.now(), fixed };
          if (fixed) console.log(`[House] 错挂丫鬟归位：${fixed} 人`);
        }
      } catch { /* 忽略 */ }

      // 一次性：私兵没补够的，补齐到账上兵额      // 一次性：私兵没补够的，补齐到账上兵额
      try {
        if (world.flags?.privateArmyV2 !== true) {
          const troops = Number(world.factions?.wangjia?.troops) || 0;
          const have = Object.values(world.actors || {}).filter((a) => a && !a.dead && /私兵/.test(String(a.role || ''))).length;
          const need = Math.max(0, troops - have);
          const barrackId = Object.keys(world.places || {}).find((id) => /兵营|校场|后营/.test(String(world.places[id]?.name || ''))) || 'street';
          const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
          let made = 0;
          for (let i = 0; i < need; i += 1) {
            let nm = fallbackName(world, 'male') || `王勇${['二','三','四','五','六','七','八','九'][i % 8]}`;
            if (usedNames.has(nm)) nm = `${nm}郎`;
            usedNames.add(nm);
            const id = `wangjia_soldier_${Date.now()}_${i}`;
            world.actors[id] = {
              id, name: nm, role: '私兵', title: '私兵', gender: 'male',
              age: 20 + Math.floor(Math.random() * 12), home: barrackId, location: barrackId,
              money: 0.5, relations: {}, origin: 'private_army', faction: 'wangjia',
            };
            made += 1;
          }
          world.flags = world.flags || {};
          world.flags.privateArmyV2 = true;
          if (made) console.log(`[Army] 私兵补齐：${made} 人`);
        }
      } catch { /* 忽略 */ }

      // 一次性：账上私兵落到兵营名册（真人）      // 一次性：账上私兵落到兵营名册（真人）
      try {
        if (!world.flags?.privateArmyV1) {
          const troops = Number(world.factions?.wangjia?.troops) || 0;
          const have = Object.values(world.actors || {}).filter((a) => a && !a.dead && /私兵/.test(String(a.role || ''))).length;
          const need = Math.max(0, troops - have);
          // 兵营：城里没有就建一处
          let barrackId = Object.keys(world.places || {}).find((id) => /兵营|校场/.test(String(world.places[id]?.name || '')));
          if (!barrackId) {
            world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
            barrackId = `place_${world.flags.placeSeq}`;
            world.places[barrackId] = { id: barrackId, name: '临江·王宅·后营', exits: ['street'], dynamic: true, use: 'barrack' };
            console.log('[Army] 建了后营');
          }
          let made = 0;
          const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
          for (let i = 0; i < need; i += 1) {
            let nm = fallbackName(world, 'male');
            if (!nm) {
              const base = (fallbackName(world, 'male') || '王勇');
              nm = `${base}${['二', '三', '四', '五', '六', '七', '八', '九', '十'][i % 9]}`;
            }
            if (usedNames.has(nm)) nm = `${nm}郎`;
            usedNames.add(nm);
            const id = `wangjia_soldier_${Date.now()}_${i}`;
            world.actors[id] = {
              id, name: nm, role: '私兵', title: '私兵', gender: 'male',
              age: 20 + Math.floor(Math.random() * 12),
              home: barrackId, location: barrackId, money: 0.5,
              relations: {}, origin: 'private_army', faction: 'wangjia',
            };
            made += 1;
          }
          world.flags = world.flags || {};
          world.flags.privateArmyV1 = { at: Date.now(), made };
          console.log(`[Army] 私兵落籍：${made} 人（账上 ${troops}）`);
        }
      } catch { /* 忽略 */ }

      // 一次性：给相公几件真东西      // 一次性：给相公几件真东西（房契、酒楼契、茶坊契、茶山契）
      try {
        ensureItems(world);
        if (!world.flags?.itemSeedV1 && Object.keys(world.items).length === 0) {
          const seeds = [
            ['临江王宅房契', '契纸'], ['运河酒楼契', '契纸'],
            ['临江茶坊契', '契纸'], ['紫阳山茶山契', '契纸'],
            ['崔家请帖', '请帖'],
          ];
          for (const [nm, kind] of seeds) addItem(world, { name: nm, kind, holder: 'husband' });
          world.flags = world.flags || {};
          world.flags.itemSeedV1 = { at: Date.now(), n: seeds.length };
          console.log(`[Item] 入册 ${seeds.length} 件`);
        }
      } catch { /* 忽略 */ }

      // 一次性：客栈只留一条门路      // 一次性：客栈只留一条门路——柜台并入客栈，人挪回客栈里
      try {
        if (!world.flags?.innOneEntryV1) {
          let moved = 0;
          let hidden = 0;
          for (const [pid, pl] of Object.entries(world.places || {})) {
            if (!pl?.name || !/客栈.*前店柜台|前店柜台/.test(String(pl.name))) continue;
            const innId = pl.parent && world.places?.[pl.parent] ? pl.parent : Object.keys(world.places || {}).find((id) => /客栈/.test(String(world.places[id]?.name || '')) && !/柜台/.test(String(world.places[id]?.name || '')) && String(world.places[id]?.name || '') === String(pl.name).split('·')[0]);
            if (!innId) continue;
            for (const a of Object.values(world.actors || {})) {
              if (a && !a.dead && a.location === pid) { a.location = innId; moved += 1; }
            }
            pl.hidden = true;
            hidden += 1;
          }
          world.flags = world.flags || {};
          world.flags.innOneEntryV1 = { at: Date.now(), moved, hidden };
          console.log(`[Inn] 柜台并入客栈：挪 ${moved} 人，隐藏 ${hidden} 处`);
        }
      } catch { /* 忽略 */ }

      // 一次性：客栈掌柜站到前店柜台      // 一次性：客栈掌柜站到前店柜台      // 一次性：客栈掌柜站到前店柜台（不在后头房间里）
      try {
        if (!world.flags?.innFrontV1) {
          let moved = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (!/客栈掌柜|跑堂|伙计/.test(String(a.role || ''))) continue;
            const pn = String(world.places?.[a.location]?.name || '');
            if (!/客栈/.test(pn) || /柜台/.test(pn)) continue;
            const front = Object.keys(world.places || {}).find((id) => String(world.places[id]?.name || '') === `${pn}·前店柜台`);
            if (front) { a.location = front; moved += 1; }
          }
          world.flags = world.flags || {};
          world.flags.innFrontV1 = { at: Date.now(), moved };
          if (moved) console.log(`[Inn] 掌柜上前柜台：${moved} 人`);
        }
      } catch { /* 忽略 */ }

      // 一次性：临江的两家客栈并成一家      // 一次性：临江的两家客栈并成一家（老"临江客栈"为准）
      try {
        if (!world.flags?.innMergeV1) {
          const legacyFront = Object.keys(world.places || {}).find((id) => world.places[id]?.name === '临江客栈·前店柜台');
          const dupIds = Object.keys(world.places || {}).filter((id) => /^临江_inn/.test(id));
          let moved = 0;
          for (const id of dupIds) {
            const pl = world.places[id];
            const isFront = /前店|柜台/.test(String(pl?.name || ''));
            const dest = isFront && legacyFront ? legacyFront : 'inn';
            for (const a of Object.values(world.actors || {})) {
              if (a && !a.dead && a.location === id) { a.location = dest; moved += 1; }
            }
            delete world.places[id];
          }
          if (world.flags?.cityBase?.['临江府']) world.flags.cityBase['临江府'].innId = 'inn';
          world.flags = world.flags || {};
          world.flags.innMergeV1 = { at: Date.now(), moved, removed: dupIds.length };
          if (dupIds.length) console.log(`[Inn] 合并临江客栈：清 ${dupIds.length} 处，迁 ${moved} 人`);
        }
      } catch { /* 忽略 */ }

      // 一次性：每城客栈得有个掌柜      // 一次性：每城客栈得有个掌柜（不然开房没人应）+ 清掉"付3两"这类脏地点
      try {
        if (!world.flags?.innFixV1) {
          let added = 0;
          for (const [city, b] of Object.entries(world.flags?.cityBase || {})) {
            const innId = b?.innId;
            if (!innId || !world.places?.[innId]) continue;
            const has = Object.values(world.actors || {}).some((a) => a && !a.dead && a.location === innId && /掌柜|伙计|跑堂/.test(String(a.role || '')));
            if (has) continue;
            const used = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
            let nm = '';
            for (let i = 0; i < 20; i += 1) {
              const cand = ['钱', '孙', '李', '周', '吴', '郑', '王', '冯'][Math.floor(Math.random() * 8)] + ['掌柜', '掌柜', '二掌柜'][Math.floor(Math.random() * 3)];
              if (!used.has(cand)) { nm = cand; break; }
            }
            if (!nm) continue;
            const id = `${city.replace(/府$|县$|州$/g, '')}_innkeeper`;
            world.actors[id] = {
              id, name: nm, role: '客栈掌柜', title: '客栈掌柜', gender: 'male',
              age: 38 + Math.floor(Math.random() * 12), home: innId, location: innId,
              money: 12, relations: {}, origin: 'city_base',
            };
            added += 1;
          }
          let removed = 0;
          for (const [pid, pl] of Object.entries(world.places || {})) {
            if (!pl?.name || !/付[\d一二三四五六七八九十]+两/.test(String(pl.name))) continue;
            const fallback = Array.isArray(pl.exits) && pl.exits.length ? pl.exits[0] : 'street';
            for (const a of Object.values(world.actors || {})) {
              if (a && !a.dead && a.location === pid) a.location = fallback;
            }
            delete world.places[pid];
            removed += 1;
          }
          world.flags = world.flags || {};
          world.flags.innFixV1 = { at: Date.now(), added, removed };
          console.log(`[Inn] 补掌柜 ${added} 城；清脏地点 ${removed} 处`);
        }
      } catch { /* 忽略 */ }

      // 一次性：婚姻字段收口      // 一次性：婚姻字段收口（相公不挂单一配偶）+ 家仆只留本宅的 + 先起两股匪患
      try {
        if (!world.flags?.spouseHouseFixV1) {
          const h = world.actors?.husband;
          if (h?.spouse) h.spouse = null;
          let cleaned = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (!a.household) continue;
            const homeName = String(world.places?.[a.home]?.name || '');
            if (homeName.startsWith('临江·王宅')) continue;
            a.household = false;
            cleaned += 1;
          }
          // 先起两股匪，免得剿匪时"没有匪患"
          world.bandits = world.bandits && typeof world.bandits === 'object' ? world.bandits : {};
          if (Object.keys(world.bandits).length === 0) {
            const day = Number(world.clock?.day) || 1;
            const seeds = [
              { id: `bandit_临江府_${day}_a`, name: '临江府水匪', kind: 'water', strength: 10, homeCity: '临江府' },
              { id: `bandit_临江府_${day}_b`, name: '运河两岸散匪', kind: 'water', strength: 7, homeCity: '临江府' },
            ];
            for (const b of seeds) {
              world.bandits[b.id] = {
                ...b, region: world.cities?.临江府?.region || '江南',
                leader: '匪首', tier: 1,
                silver: Math.round(b.strength * 0.5 * 100) / 100,
                grain: Math.round(b.strength * 1.2 * 100) / 100,
                infamy: 25, createdDay: day,
              };
            }
            console.log('[Bandit] 起两股匪患供剿');
          }
          world.flags = world.flags || {};
          world.flags.spouseHouseFixV1 = { at: Date.now(), cleaned };
          console.log(`[House] 家仆收口：清 ${cleaned} 人；相公配偶字段已清空`);
        }
      } catch { /* 忽略 */ }

      // 一次性：护院家丁按账上兵额收口，多出来的遣散自谋出路      // 一次性：护院家丁按账上兵额收口，多出来的遣散自谋出路
      try {
        if (!world.flags?.staffDischargeV1) {
          const troops = Number(world.factions?.wangjia?.troops) || 0;
          const kinds = world.factions?.wangjia?.kinds || {};
          const wantGuard = Number(kinds.guard) || Math.min(6, troops);
          const wantRetain = Math.max(0, troops - wantGuard);
          const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && /家丁|护院/.test(String(a.role || '') || String(a.title || '')));
          all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
          let keptGuard = 0;
          let keptRetain = 0;
          const fired = [];
          for (const a of all) {
            const isGuard = /家丁/.test(String(a.role || a.title || ''));
            if (isGuard && keptGuard < wantGuard) { keptGuard += 1; continue; }
            if (!isGuard && keptRetain < wantRetain) { keptRetain += 1; continue; }
            // 遣散：不再算府里人，成了街上的百姓
            a.role = '百姓';
            a.title = '百姓';
            a.servant = false;
            delete a.household;
            delete a.householdOwner;
            delete a.quarters;
            delete a.duty;
            a.location = 'street';
            fired.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.staffDischargeV1 = { at: Date.now(), keptGuard, keptRetain, fired: fired.length };
          console.log(`[Staff] 遣散 ${fired.length} 人，留 家丁${keptGuard}/护院${keptRetain}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：户主关系只落在本宅的人身上      // 一次性：户主关系只落在本宅的人身上；被误拉到厅上的外人送回原处
      try {
        if (!world.flags?.kinScopeFixV1) {
          let cleared = 0;
          let sentHome = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const homeName = String(world.places?.[a.home]?.name || '');
            const inEstate = homeName.startsWith('临江·王宅');
            if (a.householdOwner === 'husband' && !inEstate && String(a.spouse || '') !== 'husband') {
              delete a.householdOwner;
              cleared += 1;
            }
            const hereName = String(world.places?.[a.location]?.name || '');
            if (/议事厅/.test(hereName) && a.home && !inEstate && world.places?.[a.home]) {
              a.location = a.home;
              sentHome += 1;
            }
          }
          world.flags = world.flags || {};
          world.flags.kinScopeFixV1 = { at: Date.now(), cleared, sentHome };
          if (cleared || sentHome) console.log(`[House] 户主收口：清 ${cleared} 人，送回 ${sentHome} 人`);
        }
      } catch { /* 忽略 */ }

      // 一次性：户主关系落到人身上      // 一次性：户主关系落到人身上（谁家的人，归哪个户主管）
      try {
        if (!world.flags?.householdOwnerV1) {
          let n = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const kin = String(a.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷|家丁|护院|管事|管家/.test(String(a.role || ''));
            if (!kin) continue;
            if (a.householdOwner) continue;
            a.householdOwner = 'husband';
            n += 1;
          }
          world.flags = world.flags || {};
          world.flags.householdOwnerV1 = { at: Date.now(), n };
          if (n) console.log(`[House] 户主关系落籍：${n} 人归相公府`);
        }
      } catch { /* 忽略 */ }

      // 一次性：东家本钱（启动资金），只发一次，进流水
      try {
        if (!world.flags?.startupGrantV1 && world.assets) {
          const grant = 8000;
          world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + grant) * 100) / 100;
          world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
          world.ledger.push({ day: world.clock?.day || 1, hour: world.clock?.hour || 0, delta: grant, title: '东家本钱（启动）', by: 'husband', balance: world.assets.silver });
          world.flags = world.flags || {};
          world.flags.startupGrantV1 = { at: Date.now(), grant };
          console.log(`[Money] 启动本钱 +${grant} 两，现银 ${world.assets.silver}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：本宅内眷被支到外头的，收回府里（家在哪，人就该在哪）
      try {
        if (!world.flags?.kinHomeFixV1) {
          const moved = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const isKin = String(a.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷/.test(String(a.role || ''));
            if (!isKin) continue;
            const homeName = String(world.places?.[a.home]?.name || '');
            if (!homeName.startsWith('临江·王宅')) continue;
            const hereName = String(world.places?.[a.location]?.name || '');
            if (hereName.startsWith('临江·王宅')) continue;
            a.location = a.home;
            moved.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.kinHomeFixV1 = { at: Date.now(), moved };
          if (moved.length) console.log(`[Space] 内眷收回府里：${moved.join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：侧室住东厢、别在街上晃；仪式状态归端庄
      try {
        if (!world.flags?.sideRoomFixV1) {
          const eastRoom = Object.keys(world.places || {}).find((id) => /mansion_east/.test(id));
          const fixed = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (String(a.spouse || '') !== 'husband') continue;
            if (!/侧室|如夫人|二房|妾|姨娘|通房/.test(String(a.role || ''))) continue;
            if (eastRoom) { a.home = eastRoom; a.location = eastRoom; }
            if (a.intimacy) { a.intimacy.ritual = 'solemn'; a.intimacy.tone = 0; }
            fixed.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.sideRoomFixV1 = { at: Date.now(), fixed };
          if (fixed.length) console.log(`[Rank] 侧室归东厢：${fixed.join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：娶进来的小姐/才女，名分改成侧室（不再是"小姐"）
      try {
        if (!world.flags?.rankNameFixV2) {
          const fixed = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (String(a.spouse || '') !== 'husband') continue;
            if (!/小姐|才女|姑娘/.test(String(a.role || ''))) continue;
            fixed.push(`${a.name}：${a.role}→侧室`);
            a.role = '侧室';
            a.title = '侧室';
            a.marital = 'concubine';
            const eastRoom = Object.keys(world.places || {}).find((id) => /mansion_east/.test(id));
            if (eastRoom) { a.home = eastRoom; a.location = eastRoom; }
            if (a.intimacy) { a.intimacy.ritual = 'solemn'; a.intimacy.tone = 0; }
          }
          world.flags = world.flags || {};
          world.flags.rankNameFixV2 = { at: Date.now(), fixed };
          if (fixed.length) console.log(`[Rank] 名分改正：${fixed.join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：被暗号误结算的侧室，亲密状态归零（没真到那一步）
      try {
        if (!world.flags?.sideIntimacyFixV1) {
          let n = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (String(a.spouse || '') !== 'husband') continue;
            if (/正妻/.test(String(a.role || ''))) continue;
            if (!a.intimacy?.consummated) continue;
            a.intimacy.consummated = false;
            a.intimacy.level = 0;
            a.intimacy.lastAt = 0;
            a.intimacy.ritual = 'solemn';
            n += 1;
            console.log(`[Intimacy] ${a.name} 亲密状态归零（未真到那一步）`);
          }
          world.flags = world.flags || {};
          world.flags.sideIntimacyFixV1 = { at: Date.now(), n };
        }
      } catch { /* 忽略 */ }

      // 一次性：阶级人物被挪进王宅/住错府的，按 id 归回本家府邸
      try {
        if (!world.flags?.classHomeFixV1) {
          const moved = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.origin !== 'city_class') continue;
            if (a.spouse === 'husband') continue;
            const m = String(a.id).match(/^(.+?)_(gentry|servant)_(\d+)_/);
            if (!m) continue;
            const estateId = `${m[1]}_estate_${m[3]}`;
            if (!world.places?.[estateId]) continue;
            if (a.home === estateId && a.location === estateId) continue;
            moved.push(`${a.name}:${world.places?.[a.location]?.name || a.location}→${world.places?.[estateId]?.name || estateId}`);
            a.home = estateId;
            a.location = estateId;
          }
          // 内眷被挪到别处的，归回王宅正房
          const consorts = Object.values(world.actors || {}).filter((a) => a && !a.dead
            && /正妻|如夫人|二房|通房/.test(String(a.role || '')) && world.places?.husband_room);
          for (const a of consorts) {
            if (a.home === 'husband_room' && a.location === 'husband_room') continue;
            moved.push(`${a.name}→正房`);
            a.home = 'husband_room';
            a.location = 'husband_room';
          }
          world.flags = world.flags || {};
          world.flags.classHomeFixV1 = { at: Date.now(), moved };
          if (moved.length) console.log(`[Space] 归位 ${moved.length} 人：${moved.slice(0, 6).join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：城里阶级人物被暗号误结算成"相好"的，归零
      try {
        if (!world.flags?.classIntimacyFixV1) {
          const cleared = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.origin !== 'city_class') continue;
            if (!a.intimacy?.consummated) continue;
            if (a.spouse === 'husband') continue;
            a.intimacy.consummated = false;
            a.intimacy.level = 0;
            a.intimacy.lastAt = 0;
            cleared.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.classIntimacyFixV1 = { at: Date.now(), cleared };
          if (cleared.length) console.log(`[Intimacy] 清理阶级误标：${cleared.join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：阶级人物被误标成"相公府里人"，清掉（他们有自己的府）
      try {
        if (!world.flags?.classHouseholdFixV1) {
          let n = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.origin !== 'city_class') continue;
            if (!a.household) continue;
            delete a.household;
            n += 1;
          }
          world.flags = world.flags || {};
          world.flags.classHouseholdFixV1 = { at: Date.now(), cleared: n };
          if (n) console.log(`[Class] 清掉误标府内人：${n} 人`);
        }
      } catch { /* 忽略 */ }

      // 一次性：阶级生成时重名的，改成唯一姓名（按 id 保留先后）
      try {
        if (!world.flags?.nameDedupeV1) {
          const seen = new Set();
          const renamed = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead || !a.name) continue;
            if (!seen.has(a.name)) { seen.add(a.name); continue; }
            if (!a.id || !/gentry|tycoon|poetess|local|notable|matchmaker|servant/.test(String(a.id))) continue;
            const nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            if (!nm || seen.has(nm)) continue;
            renamed.push(`${a.name}→${nm}`);
            a.name = nm;
            seen.add(nm);
          }
          world.flags = world.flags || {};
          world.flags.nameDedupeV1 = { at: Date.now(), renamed: renamed.length };
          if (renamed.length) console.log(`[Name] 重名改正 ${renamed.length} 人：${renamed.slice(0, 6).join('、')}…`);
        }
      } catch { /* 忽略 */ }

      // 一次性：清掉"成过事却没记日子"的误标（真成事会留 lastAt）
      try {
        if (!world.flags?.intimacyCleanV1) {
          const bad = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a?.intimacy?.consummated) continue;
            if (Number(a.intimacy.lastAt || 0) > 0) continue;
            a.intimacy.consummated = false;
            a.intimacy.level = 0;
            bad.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.intimacyCleanV1 = { at: Date.now(), cleared: bad };
          if (bad.length) console.log(`[Intimacy] 清理误标：${bad.join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 老城补配套：差事表 + 乡绅/衙役 + 媒婆
      try {
        for (const cn of Object.keys(world.flags?.cityBase || {})) ensureMatchmaker(world, cn);
      } catch { /* 忽略 */ }
      try { for (const cn of Object.keys(world.flags?.cityBase || {})) ensureCityClasses(world, cn); } catch { /* 忽略 */ }
      try { dailyMarriages(world); } catch { /* 忽略 */ }
      try { maybeOfferAlliance(world); } catch { /* 忽略 */ }
      // 老城补配套：差事表 + 乡绅/衙役
      try {
        for (const cn of Object.keys(world.flags?.cityBase || {})) ensureCityExtras(world, cn);
      } catch { /* 忽略 */ }
      const evicted = evictOutsiders(world);          // 混进后宅的外人，请出去

      // 一次性：房间不自成一宅（西厢房曾被当成宅根，长出第二座七进大宅）
      try {
        if (!world.flags?.nestedRoomDemoteV2) {
          const demoted = demoteNestedMansions(world);
          world.flags = world.flags || {};
          world.flags.nestedRoomDemoteV2 = { at: Date.now(), demoted };
          if (demoted.length) {
            console.log(`[Space] 房间降格（不再自成一宅）：${demoted.join('、')}`);
            world.__migratedDirty = true;
          }
        }
      } catch (e) { console.warn('[Space] 房间降格失败：', e.message); }

      // 宅子的房间账被清空过（只剩门）：按等第把院子补回来，否则人会"无处可去"
      try {
        for (const [pid, pl] of Object.entries(world.places || {})) {
          if (!pl || !pl.residence) continue;
          if (pl.isRoom || pl.parent) continue;   // 房间不是宅子，绝不给它建院子
          const n = Object.keys(pl.rooms || {}).length;
          if (n >= 5) continue;
          ensureResidence(world, pid, { grade: Number(pl.grade) || 7, ownerId: pl.owner || null });
          console.log(`[Spaces] 补齐宅院房间账：${pl.name || pid}（原 ${n} 间）`);
        }
      } catch { /* 忽略 */ }

      // 一次性：把早年自拟名单生成的护院/家丁，改成世界姓名池里的名字（id 不变）
      try {
        if (!world.flags?.staffRenameV1) {
          let renamed = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (!/护院|家丁/.test(String(a.role || ''))) continue;
            if (!String(a.id || '').startsWith('staff_')) continue;
            if (!/阿[福顺贵全安平庆寿泰和义勇]/.test(String(a.name || ''))) continue;
            const nm = fallbackName(world, 'male');
            if (!nm) continue;
            console.log(`[Staff] 改名：${a.name} → ${nm}`);
            a.name = nm;
            renamed += 1;
          }
          world.flags = world.flags || {};
          world.flags.staffRenameV1 = { at: Date.now(), renamed };
          console.log(`[Staff] 护院改名完成：${renamed} 人`);
        }
      } catch { /* 忽略 */ }

      // 房间分级补正（老存档）：按这间房"是干什么用的"重定门第，前堂可待客，其余止步
      try {
        const gradeOf = (use) => {
          const u = String(use || '');
          if (u === 'shop_floor' || u === 'hall' || u === 'gate' || u === 'yard') return 'public_shop';
          if (u === 'bedroom') return 'family_inner';
          if (u === 'kitchen' || u === 'store' || u === 'workshop') return 'staff_only';
          return 'staff_only';
        };
        const junk = [];
        for (const [pid, pl] of Object.entries(world.places || {})) {
          if (!pl) continue;
          // 房间的房间（父地点本身也是房间）——是早先误建的，清掉
          const par = pl.parent ? world.places?.[pl.parent] : null;
          if (par && par.parent) { junk.push(pid); continue; }
          if (pl.rooms) {
            for (const rec of Object.values(pl.rooms)) {
              if (!rec) continue;
              rec.access = gradeOf(rec.use);
              const rp = world.places?.[rec.id];
              if (rp) { rp.access = rec.access; rp.use = rec.use; }
            }
          } else if (pl.parent && !pl.residence) {
            pl.access = gradeOf(pl.use);
          }
        }
        for (const j of junk) { delete world.places[j]; }
        if (junk.length) console.log(`[Spaces] 清掉 ${junk.length} 处"房间里的房间"`);
      } catch { /* 忽略 */ }
      try { refreshTitles(world); } catch { /* 忽略 */ }   // 身份跟着营生变
      try { ensureStalls(world, 'street'); } catch { /* 忽略 */ }  // 街上的摊子按点来去
      const collapsed = collapseRoomPlaces(world);   // 房间收回账上，不再各占一个地点
      const a0 = pruneRemoteCourts(world);
      const a = pruneForeignRooms(world) + a0;
      const b = settleItinerants(world);
      const c = buildPremises(world);
      const d = buildCourts(world);
      let up = 0;
      for (const pid of Object.keys(world.places || {})) {
        const pp = world.places[pid];
        if (pp && pp.rooms) { up += upgradeResidence(world, pid); relinkResidence(world, pid); }
      }
      if (a || b || c || d || up) {
        console.log(`[Spaces] 巡检：清 ${a}｜小贩 ${b}｜经营 ${c}｜衙署 ${d}｜升级 ${up}`);
        world.__migratedDirty = true;
      }
    }
  } catch (e) {
    console.warn('[Spaces] 巡检失败：', e.message);
  }

  // 宅院巡检：同一个世界日只跑一次（不然每次读档都扫一千多个地点，接口会被拖死）
  try {
    world.flags = world.flags || {};
    const today = String(world.clock?.day || 1);
    const buildVer = String(world.flags.residenceBuildVersion || '');
    if (String(world.flags.residenceSweptDay || '') !== today || buildVer !== 'v3') {
      const r = buildAllResidences(world);
      world.flags.residenceSweptDay = today;
      world.flags.residenceBuildVersion = 'v3';
      if (r.homes || r.rooms) console.log(`[Residence] 建/补 ${r.homes} 座宅院，共 ${r.rooms} 间院子`);
    }
  } catch (e) {
    console.warn('[Residence] 宅院巡检失败：', e.message);
  }

  // 房间归位：同宅名下的院落，parent 一律挂回宅根（每次读档都跑，幂等、几乎不花钱）
  try {
    const linkedRooms = linkSameHouseRooms(world);
    if (linkedRooms) {
      console.log(`[Spaces] 院落挂回宅根：${linkedRooms} 处`);
      world.__migratedDirty = true;
    }
  } catch (e) {
    console.warn('[Residence] 院落挂回宅根失败：', e.message);
  }

  // 性别：天道衍生的人可能是 unknown，一律按名字与身份补
  try {
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead) continue;
      if (!a.gender || a.gender === 'unknown') {
        a.gender = inferGenderFromIdentity(a.name, a.role, 'male');
      }
    }
  } catch { /* 忽略 */ }

  // 一次性：从角色描述与同住关系补出夫妻（spouse 成唯一事实源）
  try {
    world.flags = world.flags || {};
    if (!world.flags.couplesLinked) {
      const pairs = linkCouples(world);
      world.flags.couplesLinked = { day: world.clock?.day || 1, pairs: pairs.length };
      if (pairs.length) console.log(`[Couple] 结成夫妻 ${pairs.length} 对：${pairs.map((x) => x.join('—')).join('、')}`);
    }
  } catch { /* 忽略 */ }

  // 一次性 v2：修悬空配偶（指向已不存在的人），再重新结对
  try {
    world.flags = world.flags || {};
    if (!world.flags.couplesLinkedV2) {
      const pairs = linkCouples(world);
      world.flags.couplesLinkedV2 = { day: world.clock?.day || 1, pairs: pairs.length };
      if (pairs.length) console.log(`[Couple] 重修夫妻 ${pairs.length} 对`);
    }
  } catch { /* 忽略 */ }

  // 一次性：把"把别人私宅当自己家"的旧数据纠正回自家（如过门人占了玩家小院）
  try {
    world.flags = world.flags || {};
    if (!world.flags.trespassHomesRepaired) {
      const evs = [];
      const fixed = repairTrespassHomes(world, evs, (w, e) => ({ ...e, at: Date.now(), day: w.clock?.day || 1 }));
      world.flags.trespassHomesRepaired = { day: world.clock?.day || 1, fixed: fixed.length };
      if (fixed.length) console.log(`[Dwelling] 纠正 ${fixed.length} 个错占私宅的住处`);
    }
  } catch { /* 忽略 */ }

  // 一次性重判 v3：把"被旧规则判成已婚"的年轻人放回未婚池
  // 判法按名字定（不随机），同一人每次读档结果一致
  try {
    world.flags = world.flags || {};
    if (!world.flags.maritalRecheckV3) {
      let freed = 0;
      const hashOf = (n) => {
        let h = 0;
        for (const ch of String(n || '')) h = (h * 131 + ch.codePointAt(0)) % 1000;
        return h;
      };
      const singleChance = (age, gender) => {
        const a = Number(age) || 20;
        if (gender === 'male') {
          if (a <= 22) return 0.7;
          if (a <= 26) return 0.45;
          return 0.2;
        }
        if (a <= 19) return 0.85;
        if (a <= 23) return 0.75;
        if (a <= 27) return 0.55;
        if (a <= 29) return 0.35;
        return 0;
      };
      for (const a of Object.values(world.actors || {})) {
        if (!a || a.dead || a.id === 'husband') continue;
        if (a.household || a.spouse) continue;                 // 有主的（内眷/有配偶）不动
        if (a.pregnancy && !a.pregnancy.born) continue;        // 有孕的不动
        if (/通房|侍妾|小妾|姨娘/.test(String(a.role || ''))) continue;
        const age = Number(a.age) || 0;
        if (age < 16 || age > 29) continue;
        if (a.marital !== 'married') continue;                 // 只放开"被判已婚"的年轻人
        const chance = singleChance(age, a.gender);
        if ((hashOf(a.name) % 100) < chance * 100) {
          a.marital = 'single';
          freed += 1;
        }
      }
      world.flags.maritalRecheckV3 = { day: world.clock?.day || 1, freed };
      if (freed) console.log(`[Persona] 年轻未婚池放开 ${freed} 人`);
    }
  } catch { /* 忽略 */ }

  // 一次性：按新世情重算非亲眷的婚配（旧规则把 24 岁以上全判已婚，导致"全城皆已婚"）
  try {
    world.flags = world.flags || {};
    if (!world.flags.maritalRecheckV2) {
      let changed = 0;
      for (const a of Object.values(world.actors || {})) {
        if (!a || a.dead || a.id === 'husband') continue;
        const kin = a.household || a.spouse === 'husband' || a.spouse;
        const pregnant = a.pregnancy && !a.pregnancy.born;
        if (kin || pregnant) continue;
        if (!(Number(a.age) >= 18 && Number(a.age) <= 45)) continue;
        const next = inferMaritalStatus(a.name, a.role, a.age, a.gender);
        if (next !== a.marital) { a.marital = next; changed += 1; }
      }
      world.flags.maritalRecheckV2 = { day: world.clock?.day || 1, changed };
      if (changed) console.log(`[Persona] 按世情重判婚配 ${changed} 人`);
    }
  } catch { /* 忽略 */ }

  // 婚配：成年而缺字段的人，按世情补上（61 岁浆洗婆子不该是"待字闺中"）
  try {
    let fixed = 0;
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === 'husband') continue;
      // 通房/侍妾/姨娘：名分以身份为准，哪怕先前被误写成 single/married
      if (/通房|侍妾|小妾|姨娘/.test(String(a.role || ''))) {
        if (a.marital !== 'concubine') { a.marital = 'concubine'; fixed += 1; }
        continue;
      }
      // 有孕在身，就不可能是"待字闺中"
      if (a.pregnancy && !a.pregnancy.born && (!a.marital || a.marital === 'single')) {
        a.marital = /丫鬟|通房|侍妾|妾/.test(String(a.role || '')) ? 'concubine' : 'married';
        fixed += 1;
        continue;
      }
      if (a.marital) continue;
      if (!(Number(a.age) >= 18)) continue;
      const isKin = a.household || a.spouse === 'husband';
      const isConcubine = /通房|侍妾|妾|姨娘/.test(String(a.role || ''));
      if (isConcubine) { a.marital = 'concubine'; fixed += 1; continue; }
      if (isKin) { a.marital = 'married'; fixed += 1; continue; }
      a.marital = inferMaritalStatus(a.name, a.role, a.age, a.gender);
      fixed += 1;
    }
    if (fixed) console.log(`[Persona] 补全 ${fixed} 人的婚配状态`);
  } catch { /* 忽略 */ }

  // 势力：朝廷、王家，以及将来天道推演出来的枭雄
  try { ensureFactions(world); } catch (e) { console.warn('[Faction] 势力初始化失败：', e.message); }
  try { ensureMarket(world); } catch { /* 忽略 */ }
  try { ensureFame(world); } catch { /* 忽略 */ }
  try { ensureClans(world); } catch { /* 忽略 */ }
  // 待办归属：老数据没写 owner 的，一律算相公的（那是当时唯一的主角）
  try {
    for (const pr of world.promises || []) {
      if (pr && !pr.owner) pr.owner = 'husband';
    }
    for (const ap of world.appointments || []) {
      if (ap && !ap.owner) ap.owner = ap.actorId === 'husband' ? 'husband' : 'husband';
    }
  } catch { /* 忽略 */ }
  // 注册玩家补齐"一人一院 + 婚配 + 住处"（历史注册没写这三样）
  try {
    world.places = world.places || {};
    for (const [id, a] of Object.entries(world.actors || {})) {
      if (!a || !a.name || a.dead) continue;
      if (!String(id).startsWith('usr_')) continue;

      // 旧记忆里"暂投宿于临江客栈"与"有自家小院"矛盾，统一改掉
      for (const m of world.memories || []) {
        if (m && String(m.text || '').includes(a.name) && String(m.text).includes('投宿于临江客栈')) {
          m.text = String(m.text).replace('暂投宿于临江客栈大堂', '落脚在自家小院').replace('投宿于临江客栈大堂', '落脚在自家小院');
        }
      }
      if (!a.marital) a.marital = 'single';
      if (a.spouse === undefined) a.spouse = null;

      const needHouse = !a.residence || !a.residence.placeId || !world.places[a.residence.placeId];
      if (needHouse) {
        const houseId = `house_${id}`;
        if (!world.places[houseId]) {
          world.places[houseId] = {
            id: houseId,
            name: `${a.name}的小院`,
            exits: ['street'],
            owner: id,
            residence: true,
            dynamic: true,
            createdDay: world.clock?.day || 1,
          };
    try { buildAllResidences(world); } catch { /* 忽略 */ }
          world.dynamicPlaces = world.dynamicPlaces || {};
          world.dynamicPlaces[houseId] = world.places[houseId];
        }
        a.residence = { type: 'own', placeId: houseId };
        if (!a.home || a.home === 'inn') a.home = houseId;
        if (a.location === 'inn') a.location = houseId;   // 有院子就别再"投宿客栈"
        console.log(`[Reg] ${a.name} 补上住处：${world.places[houseId].name}`);
      } else {
        // 已有住处：名字统一成"某某的小院"（老数据里可能叫"陆家小院"，同姓会撞）
        const pid = a.residence.placeId;
        const want = `${a.name}的小院`;
        if (world.places[pid] && world.places[pid].name !== want) {
          world.places[pid].name = want;
        }
        if (!a.home || a.home === 'inn') a.home = pid;
        if (a.location === 'inn') a.location = pid;   // 已有院子的，也从客栈搬回家
      }
    }
  } catch { /* 忽略 */ }
  // 银两对齐：actor.money 与 wallets 只留一个真相
  try { syncMoney(world); } catch { /* 忽略 */ }
  // 承诺去重：同一件事被天道记成好几条时，只留最完整的一条。
  // 判"同一件事"用文字相似度（同一天、两条内容六成重合就算同一件）。
  try {
    const norm = (t) => String(t || '').replace(/[，。、！？；：""''（）\s]/g, '');
    const bigrams = (t) => {
      const out = new Set();
      for (let i = 0; i < t.length - 1; i += 1) out.add(t.slice(i, i + 2));
      return out;
    };
    const sim = (a, b) => {
      const A = bigrams(norm(a)); const B = bigrams(norm(b));
      if (!A.size || !B.size) return 0;
      let inter = 0;
      for (const x of A) if (B.has(x)) inter += 1;
      return inter / Math.min(A.size, B.size);
    };
    const list = (world.promises || []).filter(Boolean);
    const keep = [];
    for (const pr of list) {
      const dup = keep.find((k) => String(k.due ?? '') === String(pr.due ?? '') && sim(k.text, pr.text) >= 0.6);
      if (!dup) { keep.push(pr); continue; }
      if (String(pr.text || '').length > String(dup.text || '').length) {
        keep[keep.indexOf(dup)] = pr;
      }
    }
    if (keep.length !== list.length) {
      console.log(`[Promise] 合并重复：${list.length} → ${keep.length}`);
      world.promises = keep;
    }
  } catch { /* 忽略 */ }
  // 约定的"人"必须是活人：老数据里存过 id/拼音的，一律纠正成现名
  try {
    const byName = new Set(Object.values(world.actors || {}).filter((a) => a?.name).map((a) => a.name));
    for (const ap of world.appointments || []) {
      if (!ap) continue;
      let nm = String(ap.name || '');
      if (ap.actorId && world.actors?.[ap.actorId]?.name) { ap.name = world.actors[ap.actorId].name; continue; }
      if (byName.has(nm)) continue;
      const direct = Object.values(world.actors || {}).find((a) => a?.name === nm);
      if (direct) { ap.name = direct.name; continue; }
      const frag = nm.toLowerCase().replace(/[^a-z]/g, '');
      if (frag.length >= 3) {
        for (const len of [frag.length, 5, 4, 3]) {
          const part = frag.slice(0, len);
          const hit = Object.entries(world.actors || {}).find(([id]) => id.toLowerCase().includes(part));
          if (hit?.[1]?.name) { ap.name = hit[1].name; console.log(`[Name] 约定 ${nm} → ${hit[1].name}`); break; }
        }
      }
    }
  } catch { /* 忽略 */ }
  // 名字只是标签：按 id 把派生字段里的名字对齐（改过名也不会乱）
  try { syncNames(world); } catch { /* 忽略 */ }
  // 孤儿雇工：有雇主、却没记录是谁招的——一律归到"府里代办"的差事上，
  // 从此世界记得这批人是怎么来的（谁办的、哪天办的），不再是凭空出现的人。
  try {
    const boss = world.actors?.waner ? 'waner' : (world.actors?.yunnia ? 'yunnia' : null);
    const orphans = Object.values(world.actors || {}).filter(
      (a) => a && !a.dead && a.employer && !a.hiredBy && !a.sourceTask && a.workplace,
    );
    if (orphans.length) {
      world.tasks = Array.isArray(world.tasks) ? world.tasks : [];
      const taskId = `task_hire_${world.clock?.day || 1}`;
      let task = world.tasks.find((t) => t && t.id === taskId);
      if (!task) {
        task = {
          id: taskId,
          actorId: boss || 'husband',
          name: world.actors?.[boss]?.name || '府里',
          what: `替${orphans[0].workplace || '产业'}等添置人手`,
          status: 'done',
          startDay: Math.max(1, (world.clock?.day || 1) - 1),
          dueDay: world.clock?.day || 1,
          doneDay: world.clock?.day || 1,
          result: `请到${orphans.map((a) => a.name).join('、')}`,
          log: [{ day: world.clock?.day || 1, hour: world.clock?.hour || 0, text: '人已到岗' }],
        };
        world.tasks.push(task);
      }
      for (const a of orphans) {
        a.hiredBy = boss || 'husband';
        a.sourceTask = taskId;
        a.hiredDay = a.hiredDay || (world.clock?.day || 1);
      }
      world.notes = Array.isArray(world.notes) ? world.notes : [];
      world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${task.name}办妥了添置人手的事` });
      console.log(`[Employ] 为 ${orphans.length} 位雇工补上来历（${task.name}经办）`);
    }
  } catch { /* 忽略 */ }
  // 产业必须挂在具体地点上：不然请了人也没处站、收入也没处算
  // 产业只做"认领"：挂到同名/近名的地点上；读档时绝不新建或删除地点，
  // 地图的增删只由造物入口与清理入口负责（读档不该改拓扑）。
  try {
    world.assets = world.assets || {};
    for (const prop of (world.assets.properties || [])) {
      if (!prop || !prop.name) continue;
      const nm = String(prop.name);
      if (prop.placeId && world.places?.[prop.placeId]) {
        const onDuty = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.location === prop.placeId);
        const dutyIds = new Set(onDuty.map((a) => a.id));
        if (Array.isArray(prop.staffIds)) prop.staffIds = prop.staffIds.filter((id) => dutyIds.has(id));
        prop.staff = onDuty.length;
        continue;
      }
      const hit = Object.entries(world.places || {}).find(([, pl]) => {
        const pn = String(pl?.name || "");
        if (!pn) return false;
        if (pn === nm) return true;
        const near = Math.abs(pn.length - nm.length) <= 2;
        return near && (pn.includes(nm) || nm.includes(pn));
      });
      if (hit) {
        prop.placeId = hit[0];
        hit[1].property = true;
        hit[1].owner = hit[1].owner || prop.owner || "husband";
        console.log(`[Prop] ${nm} 认领地点 ${hit[0]}`);
      }
    }
  } catch { /* 忽略 */ }

  // 天道造过的地方，任何迁移都不许弄丢——先补回 places
  try {
    if (world.dynamicPlaces && typeof world.dynamicPlaces === 'object') {
      world.places = world.places || {};
      let restored = 0;
      for (const [id, pl] of Object.entries(world.dynamicPlaces)) {
        if (!pl || !pl.name) continue;
        if (!world.places[id]) {
          // 同名地点已存在就复用，不重复造
          const same = Object.entries(world.places).find(([, q]) => q && q.name === pl.name);
          if (same) {
            for (const a of Object.values(world.actors || {})) {
              if (a && a.location === id) a.location = same[0];
            }
          } else {
            world.places[id] = pl;
            restored += 1;
          }
        }
      }
      if (restored) console.log(`[State] 补回动态地点 ${restored} 处`);
    }
  } catch { /* 忽略 */ }
  // 清理不合生理的怀孕（年龄过大/过小，或身份明确不该有的）
  try {
    let cleared = 0;
    for (const a of Object.values(world.actors || {})) {
      if (!a || !a.pregnancy || a.pregnancy.born) continue;
      const age = Number(a.age) || 0;
      const role = String(a.role || '');
      const tooOld = age > 48;
      const tooYoung = age > 0 && age < 14;
      const sterile = /老鸨|鸨母|嬷嬷|婆婆|尼|道姑/.test(role);
      if (tooOld || tooYoung || sterile) {
        delete a.pregnancy;
        cleared += 1;
        console.log(`[Life] ${a.name}（${age}岁·${role}）的怀孕记录不合生理，已清除`);
      }
    }
    if (cleared) console.log(`[Life] 共清除 ${cleared} 条不合生理的怀孕`);
  } catch { /* 忽略 */ }
  // 清掉错误的主仆关系：对方不是同宅主家的，一律断开
  try {
    let removed = 0;
    for (const [aId, m] of Object.entries(world.bonds || {})) {
      const a = world.actors?.[aId];
      if (!a || !m) continue;
      for (const [bId, b] of Object.entries(m)) {
        if (!b || b.type !== '主仆') continue;
        const other = world.actors?.[bId];
        const ok = a?.household && (other?.household || other?.id === 'husband');
        if (!ok) {
          delete m[bId];
          const back = world.bonds?.[bId];
          if (back) delete back[aId];
          removed += 1;
        }
      }
    }
    if (removed) console.log(`[Bonds] 清理错误主仆关系 ${removed} 条`);
  } catch { /* 忽略 */ }
  try { seedMenses(world); } catch { /* 忽略 */ }
  // 按身份修正性别：早年生成的郎中/掌柜/镖头被误标成女
  try {
    const MALE_ROLE = /郎中|大夫|掌柜|东家|镖头|镖师|先生|夫子|僧人|道士|捕头|仵作|书办|衙役|工头|船夫|艄公|小二|伙计|小厮|教书/;
    const FEMALE_ROLE = /婆|娘|嫂|姑|妇|女|氏|姐|妹|丫鬟|丫头|嬷嬷|稳婆|媒婆|绣娘/;
    let fixed = 0;
    for (const a of Object.values(world.actors || {})) {
      if (!a || !a.role) continue;
      const role = String(a.role);
      if (a.id === 'husband') { a.gender = 'male'; continue; }
      // 名字里有 娘/婆/姑/嫂/妹/姐 的，一律女（如「锦娘」当掌柜）
      if (/[娘婆姑嫂妹姐氏]/.test(String(a.name || '')) && !/公|郎|爷|叔|伯|先生/.test(String(a.name || ''))) {
        if (a.gender !== 'female') { a.gender = 'female'; fixed += 1; }
        continue;
      }
      if (MALE_ROLE.test(role) && !FEMALE_ROLE.test(role)) {
        if (a.gender !== 'male') { a.gender = 'male'; fixed += 1; }
      }
    }
    if (fixed) console.log(`[State] 性别修正：${fixed} 位（郎中等误标为女）`);
  } catch { /* 忽略 */ }
  // 旧存档：知县名字是「李知县」这种占位，改成真名
  try {
    for (const a of Object.values(world.actors || {})) {
      if (!a || !a.name) continue;
      const m = String(a.name).match(/^([\u4e00-\u9fa5])知县$/);
      if (!m) continue;
      const { name } = makeOfficialName(String(a.id || a.role || ''), m[1]);
      a.name = name;
      console.log(`[State] 知县改名：${m[1]}知县 → ${name}`);
    }
  } catch { /* 忽略 */ }
  // 旧事去重：同一句记两遍只留一遍
  try {
    const seen = new Set();
    world.memories = (world.memories || []).filter((m) => {
      const t = String(m?.text || '').trim();
      if (!t) return false;
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
    migrateMemories(world);
  } catch { /* 忽略 */ }
  let fixedGhosts = 0;
  // 强力清除所有 clinic / workshop 等英文幽灵地名，全员位置自愈归位（60 秒一次，别每读档都刷）
  try {
    if (Date.now() - (globalThis.__ghostHealedAt || 0) > 60000) {
    globalThis.__ghostHealedAt = Date.now();
    delete world.places?.clinic;
    delete world.places?.workshop;
    delete world.places?.school;

    for (const [aid, a] of Object.entries(world.actors || {})) {
      if (!a || a.dead) continue;
      const isGhost = a.location === 'clinic' || a.location === 'workshop' || !world.places?.[a.location] || /^[a-zA-Z_-]+$/.test(String(world.places?.[a.location]?.name || ''));
      if (isGhost) {
        if (aid === 'waner') {
          a.location = 'backyard';
          console.log(`[State] 正妻沈婉儿位置自愈归位 → 后院暖阁`);
        } else if (aid === 'husband') {
          a.location = world.places?.inn_room ? 'inn_room' : 'tea_house';
          console.log(`[State] 相公位置自愈归位 → ${a.location}`);
        } else {
          a.location = a.home && world.places?.[a.home] ? a.home : 'street';
          fixedGhosts += 1;
        }
      }
    }
    }
    if (fixedGhosts) console.log(`[State] 位置自愈：${fixedGhosts} 人归位`);
  } catch (e) { console.warn('[State] 幽灵地点清理异常:', e.message); }

  // 确保相公的家宅永久锁定在临江茶坊，绝不随任何移动被篡改
  try {
    if (world.actors?.husband) {
      world.actors.husband.home = 'tea_house';
    }
  } catch { /* 忽略 */ }

  // 清除于子归的“黑洞塌方”死循环剧本，强化夫妻情深与热烈调情
  try {
    if (world.npcArcs) {
      for (const [k, v] of Object.entries(world.npcArcs)) {
        if (v && /黑洞|塌出|空响/.test(String(v.text || '') + String(v.lastStep || ''))) {
          delete world.npcArcs[k];
          console.log('[State] 清除黑洞死循环剧本：' + k);
        }
      }
    }
    const yzg = world.actors?.npc_2 || Object.values(world.actors || {}).find((a) => a && a.name === '于子归');
    if (yzg) {
      yzg.goals = ['护好自家美貌娇妻紫嫣', '多抽空回酒肆陪媳妇温存', '在外跑工期挣大银子养家'];
      yzg.relations = yzg.relations || {};
      yzg.relations.liuwenxia = { trust: 95, desire: 85, fear: 0, grievance: 0 };
      yzg.intimacy = { level: 4, tone: 2, lastAt: world.clock?.day || 1, ritual: 'unlocked', willing: 'eager' };
    }
  } catch { /* 忽略 */ }

  // 清除“底是什么铺”等疑问词误建的垃圾地点
  try {
    for (const [pid, pl] of Object.entries(world.places || {})) {
      if (!pl || !pl.name) continue;
      if (/(底是什么|是什么|什么铺|算什么|怎么|怎样|凭什么)/.test(pl.name)) {
        delete world.places[pid];
        for (const a of Object.values(world.actors || {})) {
          if (a && a.location === pid) a.location = a.home || 'street';
        }
        console.log(`[State] 清除疑问词垃圾地点：「${pl.name}」`);
      }
    }
  } catch { /* 忽略 */ }

  try {
    const fallback = world.places?.street ? 'street' : (world.places?.backyard ? 'backyard' : Object.keys(world.places || {})[0]);
    for (const a of Object.values(world.actors || {})) {
      if (!a) continue;
      if (a.location && !world.places?.[a.location]) {
        const back = world.places?.[a.home] ? a.home : fallback;
        if (back) {
          console.log(`[State] ${a.name} 位置失效(${a.location}) → ${world.places[back]?.name || back}`);
          a.location = back;
        }
      }
      if (a.home && !world.places?.[a.home]) a.home = fallback;
    }
  } catch { /* 忽略 */ }
  // 清掉误建的模糊地名（院中/屋里/房中…），人挪回后院暖阁
  try {
    const junk = /^(院中|院子里|庭院|院里|院|屋里|屋中|房中|屋内|屋里头|厅上|堂中|门口|门外|就行|不行|可行|成行|得行|行不行|过去|过去看|过去坐|应付|对付|应付过去|看看|看一下|商量一下|知会一声)$/;
    for (const [pid, pl] of Object.entries(world.places || {})) {
      if (!pl || !junk.test(String(pl.name || ''))) continue;
      const exitPlace = pl.exits && pl.exits[0] && world.places?.[pl.exits[0]] ? pl.exits[0] : null;
      const defaultBack = world.places?.backyard ? 'backyard' : (world.places?.tea_house ? 'tea_house' : null);
      const back = exitPlace || defaultBack;
      if (!back) continue;
      delete world.places[pid];
      for (const a of Object.values(world.actors || {})) {
        if (a && a.location === pid) a.location = a.home && world.places?.[a.home] && !exitPlace ? a.home : back;
        if (a && a.home === pid) a.home = back;
      }
      console.log(`[State] 垃圾地名「${pl.name}」已并回${world.places[back].name}`);
    }
  } catch { /* 忽略 */ }
  // 没写年龄的人给个合理岁数（不然生老病死跑不起来）
  try {
    const FIXED = { waner: 24, yunnia: 21, xiaocui: 17, aji: 19, husband: 26 };
    for (const [id, a] of Object.entries(world.actors || {})) {
      if (!a || a.dead || a.age) continue;
      if (FIXED[id]) { a.age = FIXED[id]; continue; }
      const role = String(a.role || '');
      if (/天子/.test(role)) a.age = 42;
      else if (/宰相|尚书|巡抚/.test(role)) a.age = 52 + (id.length % 6);
      else if (/知府|知县/.test(role)) a.age = 44 + (id.length % 8);
      // 年龄：姓名 + 身份一起看（王婆的 role 是"面摊"，只看 role 会把她判成少女）
      else if (/老鸨|鸨母/.test(role)) a.age = 38 + (id.length % 8);
      else if (/先生|老夫子|夫子/.test(role)) a.age = 58 + (id.length % 8);
      else a.age = inferAgeFromIdentity(a.name, role, a.gender, id);
    }
  } catch { /* 忽略 */ }
  // 清掉误建的重复茶坊（teahouse_shop），把人挪回 tea_house
  try {
    if (world.places?.teahouse_shop) {
      delete world.places.teahouse_shop;
      for (const a of Object.values(world.actors || {})) {
        if (a && a.location === 'teahouse_shop') a.location = 'tea_house';
        if (a && a.home === 'teahouse_shop') a.home = 'tea_house';
      }
    }
    // 只清理「地点·雅阁」这类把格式词当日名的垃圾，不再误杀真正的雅阁
    for (const [pid, p] of Object.entries(world.places || {})) {
      if (pid === 'tea_house') continue;
      const n = String(p?.name || '');
      if (/^(地点|场景|场所|时空)[·・]/.test(n)) {
        delete world.places[pid];
        for (const a of Object.values(world.actors || {})) {
          if (a && a.location === pid) a.location = 'tea_house';
          if (a && a.home === pid) a.home = 'tea_house';
        }
      }
    }
  } catch { /* 忽略 */ }
  try {
    ensureBonds(world);
  } catch { /* 关系网失败不影响读档 */ }
  // 【临江·王宅（七进大宅）自住府邸架构与相公家眷乔迁自愈】
  world.places = world.places || {};
  // 1. 府邸主正房（相公与正妻大娘子沈婉儿主起居之中枢）
  if (!world.places.husband_room) {
    world.places.husband_room = { name: '临江·王宅·正房', exits: ['tea_house', 'wang_mansion_east', 'wang_mansion_west', 'street'], owner: 'husband' };
  } else {
    const hr = world.places.husband_room;
    hr.name = '临江·王宅·正房';
    hr.owner = 'husband';
    hr.exits = ['tea_house', 'wang_mansion_east', 'wang_mansion_west', 'street'];
  }
  // 2. 府邸东跨院（二房如夫人林芸娘雅居院落）—— 是正房底下的房间，不是独立宅子
  if (!world.places.wang_mansion_east) {
    world.places.wang_mansion_east = {
      id: 'wang_mansion_east', name: '临江·王宅·东跨院', parent: 'husband_room', isRoom: true,
      residence: false, use: 'bedroom', access: 'family_inner', depth: 5,
      exits: ['husband_room'], owner: 'husband',
    };
  } else {
    const ep = world.places.wang_mansion_east;
    ep.name = '临江·王宅·东跨院';
    ep.owner = 'husband';
    ep.parent = 'husband_room';
    ep.isRoom = true;
    ep.residence = false;
    if (!ep.use) ep.use = 'bedroom';
    if (!ep.access) ep.access = 'family_inner';
    if (!ep.depth) ep.depth = 5;
  }
  // 3. 府邸西厢房（贴身丫鬟小翠及随侍值宿）—— 同样是正房底下的房间
  if (!world.places.wang_mansion_west) {
    world.places.wang_mansion_west = {
      id: 'wang_mansion_west', name: '临江·王宅·西厢房', parent: 'husband_room', isRoom: true,
      residence: false, use: 'bedroom', access: 'family_inner', depth: 5,
      exits: ['husband_room'], owner: 'husband',
    };
  } else {
    const wp = world.places.wang_mansion_west;
    wp.name = '临江·王宅·西厢房';
    wp.owner = 'husband';
    wp.parent = 'husband_room';
    wp.isRoom = true;
    wp.residence = false;
    if (!wp.use) wp.use = 'bedroom';
    if (!wp.access) wp.access = 'family_inner';
    if (!wp.depth) wp.depth = 5;
  }

  // 4. 清除把客栈混淆成大宅的误建地名，恢复客栈上房
  for (const [pid, pl] of Object.entries(world.places)) {
    if (pid !== 'husband_room' && pl && /(临江客栈·七进大宅|七进大宅|客栈.*大宅)/.test(String(pl.name || ''))) {
      pl.name = '临江客栈·天字上房';
    }
    if (pid !== 'husband_room' && pl && /^(我房间|我的房间)$/.test(String(pl.name || ''))) {
      delete world.places[pid];
      for (const a of Object.values(world.actors || {})) {
        if (a && a.location === pid) a.location = 'husband_room';
      }
    }
  }

  // 国库尺度：历史上的"几百两"是民间尺度误用，一次性抬到国家尺度（百万级）
  try {
    world.flags = world.flags || {};
    if (!world.flags.treasuryScaleDone) {
      world.court = world.court || {};
      const tr = world.court.treasury = world.court.treasury || {};
      const cur = Number(tr.silver) || 0;
      if (cur < 100000) {
        tr.silver = 1200000;
        tr.grain = Math.max(Number(tr.grain) || 0, 800);
        // 昨天的收/支是民间尺度算的，一并换成国库尺度
        if (Number(tr.lastIncome) < 10000) tr.lastIncome = Math.round((Number(tr.lastIncome) || 0) * 100 * 100) / 100;
        if (Number(tr.lastExpense) < 10000) tr.lastExpense = Math.round((Number(tr.lastExpense) || 0) * 100 * 100) / 100;
        console.log('[Treasury] 国库改按国家尺度记账：1200000 两（原 %s 两）', cur);
      }
      world.flags.treasuryScaleDone = { day: world.clock?.day || 1 };
    }
  } catch { /* 忽略 */ }

  // 国库昨日收支：上一次只换了存量，昨天那两个数还是民间尺度，这里补换一次
  try {
    world.flags = world.flags || {};
    if (!world.flags.treasuryLastScaled) {
      const tr = world.court?.treasury;
      if (tr) {
        if (Number(tr.lastIncome) > 0 && Number(tr.lastIncome) < 10000) tr.lastIncome = Math.round(Number(tr.lastIncome) * 100 * 100) / 100;
        if (Number(tr.lastExpense) > 0 && Number(tr.lastExpense) < 10000) tr.lastExpense = Math.round(Number(tr.lastExpense) * 100 * 100) / 100;
      }
      world.flags.treasuryLastScaled = { day: world.clock?.day || 1 };
    }
  } catch { /* 忽略 */ }

  // 税率落成数据：没写过的补 10%；历史上被 `|| 10` 暗中按 10% 收税的城，一次性明确为 10%
  // （只做一次，之后 0 就是真的免税，不再回填）
  try {
    world.flags = world.flags || {};
    if (!world.flags.taxBackfillDone) {
      let filled = 0;
      for (const ct of Object.values(world.cities || {})) {
        if (!ct) continue;
        const t = Number(ct.tax);
        if (!Number.isFinite(t) || t === 0) { ct.tax = 10; filled += 1; }
      }
      world.flags.taxBackfillDone = { day: world.clock?.day || 1, filled };
      if (filled) console.log(`[Tax] 一次性矫正 ${filled} 座城的税率 → 10%（此前被 || 10 暗中征收）`);
    }
  } catch { /* 忽略 */ }

  // 产业本金：买价优先；祖传/老产业按日入估个底（收入模型按本金×收益率算）
  try {
    for (const pr of (world.assets?.properties || [])) {
      if (!pr) continue;
      if (!(Number(pr.capital) > 0)) {
        const buy = Number(pr.costSilver);
        const est = Number(pr.incomePerDay) || 0;
        pr.capital = Math.round((buy > 0 ? buy : Math.max(100, est * 80)) * 100) / 100;
        console.log(`[Prop] ${pr.name} 本金记为 ${pr.capital} 两`);
      }
    }
  } catch { /* 忽略 */ }

  // 补偿：测试期之前就开着的产业，一律视同第 1 日开张（写成数据，不靠公式兜底）
  try {
    for (const pr of (world.assets?.properties || [])) {
      if (!pr) continue;
      if (pr.openedDay == null && /正常营业|已开张/.test(String(pr.status || ''))) {
        pr.openedDay = 1;
        console.log(`[Prop] ${pr.name} 视同第 1 日开张（补偿）`);
      }
    }
  } catch { /* 忽略 */ }

  // 5. 资产账本登记：相公斥资450两全款购置的七进大宅（王宅）
  world.assets = world.assets || { silver: 0, copper: 0, properties: [] };
  world.assets.properties = Array.isArray(world.assets.properties) ? world.assets.properties : [];
  let mansionProp = world.assets.properties.find((p) => p && (p.id === 'wang_mansion' || /七进大宅|王宅/.test(String(p.name || ''))));
  if (!mansionProp) {
    world.assets.properties.unshift({
      id: 'wang_mansion',
      name: '临江·王宅（七进大宅）',
      status: '自住府邸',
      owner: 'husband',
      keeper: 'husband',
      costSilver: 450,
      placeId: 'husband_room',
      desc: '临江城中七进三进三出深宅大院，飞檐斗拱、气势恢宏，后宅正房、东跨院、西厢房一应俱全，乃王家基业府邸。'
    });
  } else {
    mansionProp.id = 'wang_mansion';
    mansionProp.name = '临江·王宅（七进大宅）';
    mansionProp.status = '自住府邸';
    mansionProp.owner = 'husband';
    mansionProp.keeper = 'husband';
    mansionProp.costSilver = 450;
    mansionProp.placeId = 'husband_room';
  }

  // 6. 全家举家乔迁王宅自住府邸（相公与家眷 home 归于王宅；仅当身处幽灵客栈大宅或非法地点时自愈归位）
  const hus = world.actors?.husband;
  if (hus) {
    if (!hus.home || hus.home === 'tea_house') hus.home = 'husband_room';
    const curPName = String(world.places?.[hus.location]?.name || '');
    if (!hus.location || !world.places[hus.location] || /(客栈.*大宅|七进大宅)/.test(curPName)) {
      try { moveActor(world, 'husband', 'husband_room', 'world', '乔迁'); } catch { /* 忽略 */ }
    }
  }
  const wan = world.actors?.waner;
  if (wan) {
    if (!wan.home || wan.home === 'tea_house' || wan.home === 'yamen') wan.home = 'husband_room';
    const wanPName = String(world.places?.[wan.location]?.name || '');
    if (!wan.location || !world.places[wan.location] || /(客栈.*大宅|七进大宅)/.test(wanPName)) {
      try { moveActor(world, 'waner', 'husband_room', 'world', '乔迁'); } catch { /* 忽略 */ }
    }
  }
  const yun = world.actors?.yunnia;
  if (yun) {
    if (!yun.home || yun.home === 'tea_house' || yun.home === 'yamen') yun.home = 'wang_mansion_east';
    const yunPName = String(world.places?.[yun.location]?.name || '');
    if (!yun.location || !world.places[yun.location] || /(客栈.*大宅|七进大宅)/.test(yunPName)) {
      try { moveActor(world, 'yunnia', hus?.location === 'husband_room' ? 'husband_room' : 'wang_mansion_east', 'world', '乔迁'); } catch { /* 忽略 */ }
    }
  }
  const cui = world.actors?.xiaocui;
  if (cui) {
    if (!cui.home || cui.home === 'tea_house' || cui.home === 'yamen') cui.home = 'wang_mansion_west';
    const cuiPName = String(world.places?.[cui.location]?.name || '');
    if (!cui.location || !world.places[cui.location] || /(客栈.*大宅|七进大宅)/.test(cuiPName)) {
      try { moveActor(world, 'xiaocui', hus?.location === 'husband_room' ? 'husband_room' : 'wang_mansion_west', 'world', '乔迁'); } catch { /* 忽略 */ }
    }
  }

  // 强力清除所有 clinic / workshop 等英文幽灵地名，全员位置自愈归位
  try {
    const EN_GHOSTS = {
      clinic: '医馆',
      workshop: '匠作坊',
      school: '学堂',
      dock: '运河码头',
      granary: '常平仓',
      roads: '官道',
      inn: '临江客栈',
    };
    for (const [pid, pl] of Object.entries(world.places || {})) {
      const pName = String(pl?.name || '');
      const isEnglish = pid in EN_GHOSTS || /^[a-zA-Z_-]+$/.test(pName) || pName.toLowerCase() === 'clinic';
      if (isEnglish) {
        let realName = EN_GHOSTS[pid] || EN_GHOSTS[pName.toLowerCase()] || '长街';
        const targetEntry = Object.entries(world.places).find(([k, p]) => k !== pid && p?.name === realName);
        let targetId = targetEntry ? targetEntry[0] : null;
        if (!targetId) {
          pl.name = realName;
        } else {
          delete world.places[pid];
          for (const a of Object.values(world.actors || {})) {
            if (a && a.location === pid) a.location = targetId;
            if (a && a.home === pid) a.home = targetId;
          }
        }
      }
    }
    let yiguan = Object.entries(world.places).find(([, pl]) => /医馆|药铺|药堂/.test(String(pl?.name || '')));
    if (!yiguan) {
      world.places.place_yiguan = { name: '医馆', exits: ['street'], dynamic: true };
      yiguan = ['place_yiguan', world.places.place_yiguan];
    }
    const yiguanId = yiguan[0];

    for (const a of Object.values(world.actors || {})) {
      if (!a) continue;
      if (a.location === 'clinic' || a.location === 'workshop' || !world.places?.[a.location]) {
        if (a.id === 'waner') a.location = world.places?.backyard ? 'backyard' : 'tea_house';
        else if (a.household) a.location = world.places?.backyard ? 'backyard' : 'tea_house';
        else if (/郎中|大夫/.test(String(a.role || ''))) a.location = yiguanId;
        else if (a.home && world.places?.[a.home]) a.location = a.home;
        else a.location = yiguanId;
      }
    }
  } catch (err) {
    console.warn('[State] 幽灵地名自愈异常:', err.message);
  }

  if (!world || typeof world !== 'object') return world;
  // 地点
  for (const [id, p] of Object.entries(world.places || {})) {
    if (!p || p.owner) continue;
    if (id === 'street' || id === 'dock' || id === 'canal') p.owner = 'public';
    else if (id === 'yamen') p.owner = 'court';
    else if (id === 'yang_mansion') p.owner = 'yangzhenhua';
    else if (id === 'wine_shop') p.owner = 'liuwenxia';
    else if (id === 'goods_shop') p.owner = 'yangcaiyun';
    else p.owner = 'husband';
  }
  // 势力
  for (const [id, pw] of Object.entries(world.powers || {})) {
    if (!pw || pw.ownerActor) continue;
    if (id === 'wangjia') pw.ownerActor = 'husband';
    else if (id === 'court') pw.ownerActor = 'court';
  }
  // 线索
  for (const c of world.clues || []) {
    if (c && !c.owner) c.owner = 'husband';
  }
  // 最后一步：把天道造过的地方补回来（任何清理都不许弄丢）
  try {
    if (world.dynamicPlaces && typeof world.dynamicPlaces === 'object') {
      world.places = world.places || {};
      let restored = 0;
      for (const [id, pl] of Object.entries(world.dynamicPlaces)) {
        if (!pl || !pl.name || world.places[id]) continue;
        const same = Object.entries(world.places).find(([, q]) => q && q.name === pl.name);
        if (same) {
          for (const a of Object.values(world.actors || {})) {
            if (a && a.location === id) a.location = same[0];
          }
        } else {
          world.places[id] = pl;
          restored += 1;
        }
      }
      if (restored) console.log(`[State] 补回动态地点 ${restored} 处`);
    }
  } catch { /* 忽略 */ }
  // 不变量：已故者不留行踪（迁移里别处会把官员送回府衙，这里最后统一清）
  try {
    for (const a of Object.values(world.actors || {})) {
      if (a && a.dead && a.location) delete a.location;
    }
  } catch { /* 忽略 */ }

  return world;
}

globalThis.__stateStats = globalThis.__stateStats || { loads: 0, hits: 0, parses: 0, saves: 0, writes: 0, parseMs: 0, writeMs: 0, last: [] };
let __stateCache = { key: '', mtime: 0, size: 0, world: null };

const __turnAls = new AsyncLocalStorage();

/**
 * 一轮业务（一次聊天）内：只解析一次世界账，只写一次盘。
 * 中途所有 loadState 都拿到同一份；所有 saveState 只记脏，不落盘。
 */
export async function runInStateTurn(fn) {
  const store = { world: null, dataDir: null, dirty: false };
  return __turnAls.run(store, async () => {
    try {
      return await fn();
    } finally {
      try {
        if (store.dirty && store.world && store.dataDir) {
          __stateBatch = null;
          store.flushing = true;
          saveState(store.dataDir, store.world);
          store.flushing = false;
          store.dirty = false;
        }
      } catch (err) {
        console.warn('[State] 回合落盘失败：', err.message);
      }
    }
  });
}

export function loadState(dataDir) {
  const S = globalThis.__stateStats;
  S.loads += 1;
  const __turn = __turnAls.getStore();
  if (__turn) {
    if (__turn.world) return __turn.world;
    const __file = statePath(dataDir);
    try {
      const __st = fs.statSync(__file);
      const __key = path.resolve(__file);
      if (__stateCache.world && __stateCache.key === __key && __stateCache.mtime === __st.mtimeMs && __stateCache.size === __st.size) {
        S.hits += 1;
        __turn.world = __stateCache.world;
        __turn.dataDir = dataDir;
        return __turn.world;
      }
      S.parses += 1;
      const t0 = Date.now();
      const parsed = JSON.parse(fs.readFileSync(__file, 'utf8'));
      // 关键：回合里解析出来的这份，也要成为全局唯一的那一份
      __stateCache = { key: __key, mtime: __st.mtimeMs, size: __st.size, world: parsed };
      __turn.world = __stateCache.world;
      S.parseMs += Date.now() - t0;
      __turn.dataDir = dataDir;
      return __turn.world;
    } catch {
      __turn.world = null;
      return null;
    }
  }
  const file = statePath(dataDir);
  let __w = null;
  try {
    const st = fs.statSync(file);
    const key = path.resolve(file);
    if (__stateCache.world && __stateCache.key === key
      && __stateCache.mtime === st.mtimeMs && __stateCache.size === st.size) {
      // 文件没变：直接给一份克隆，连迁移都不用再跑
      S.hits += 1;
      return __stateCache.world;
    } else {
      __w = __loadStateInner(dataDir);
      S.parses += 1;
    const t0 = Date.now();
    __stateCache = { key, mtime: st.mtimeMs, size: st.size, world: structuredClone(__w) };
    S.parseMs += Date.now() - t0;
    }
  } catch {
    __w = __loadStateInner(dataDir);
  }
  const out = migrateOwnership(__w);
  // 迁移真的改过东西才写盘，避免每次读档都白写一遍
  if (out && out.__migratedDirty) {
    delete out.__migratedDirty;
    try { saveState(dataDir, out); } catch { /* 忽略 */ }
  }
  return out;
}

function __loadStateInner(dataDir) {
  const file = statePath(dataDir);
  const raw = readJson(file);
  if (!raw || typeof raw !== 'object') {
    const init = createInitialState(dataDir);
    init.lastRealAt = Date.now();
    saveState(dataDir, init);
    return init;
  }

  // 轻量补全：老文件缺字段时不报错，按初始值补齐（不做破坏性迁移）
  const base = createInitialState(dataDir);
  // 人物逐个合并：新版本补进来的目标/秘密/日程要能生效，同时保留线上已有的位置与关系
  // 线上已经有人叫这个名字（比如天道造过「陈郎中」），就别再塞一个预设的同名
  const liveNames = new Set(Object.values(raw.actors || {}).map((a) => String(a?.name || '')).filter(Boolean));
  const mergedActors = {};
  for (const [id, a] of Object.entries(base.actors || {})) {
    if (!raw.actors?.[id] && liveNames.has(String(a?.name || ''))) continue;
    mergedActors[id] = a;
  }
  for (const [id, actor] of Object.entries(raw.actors || {})) {
    mergedActors[id] = { ...(base.actors?.[id] || {}), ...actor };
  }

  // 物理空间解耦自愈：非王府同住内宅女眷（如紫嫣、杨采云等），绝不滞留在正房寝居或后院私宅
  for (const [id, live] of Object.entries(mergedActors)) {
    if (!live || live.dead || id === 'husband') continue;
    const isInner = ['husband_room', 'backyard'].includes(live.location);
    const isHousehold = Boolean(live.household) || ['waner', 'yunnia', 'xiaocui'].includes(id);
    if (isInner && !isHousehold) {
      live.location = (live.home && base.places?.[live.home]) ? live.home : 'wine_shop';
    }
  }
  // 夜间内眷归宅不变量：深夜（21:00-06:00），王府内眷若留在官衙或市井且相公不在该处，自动归位后院暖阁安歇
  const curHour = Number(raw.clock?.hour ?? base.clock?.hour ?? 0);
  const curHusLoc = mergedActors.husband?.location;
  if (curHour >= 21 || curHour < 6) {
    for (const id of ['waner', 'yunnia', 'xiaocui']) {
      const a = mergedActors[id];
      if (a && a.location !== curHusLoc && !['backyard', 'husband_room'].includes(a.location)) {
        a.location = 'backyard';
      }
    }
  }
  // 版本迁移：预设人物的日程/住处以代码为准（用户自己造的 npc_* 不动）
  if (Number(raw.stateVersion || 1) !== Number(base.stateVersion)) {
    for (const [id, baseActor] of Object.entries(base.actors || {})) {
      const live = mergedActors[id];
      if (!live) continue;
      if (Array.isArray(baseActor.schedule)) live.schedule = baseActor.schedule.map((s) => ({ ...s }));
      if (baseActor.home) live.home = baseActor.home;
      if (baseActor.gender) live.gender = baseActor.gender;
      if (typeof baseActor.household === 'boolean') live.household = baseActor.household;
      if (typeof baseActor.servant === 'boolean') live.servant = baseActor.servant;
      if (baseActor.goals) live.goals = [...baseActor.goals];
      if (baseActor.secret) live.secret = baseActor.secret;
    }
    // 随家眷属住处规范：随科与静儿统一归于随家小院
    for (const a of Object.values(mergedActors)) {
      if (a && (a.name === '随科' || a.id === 'npc_4')) a.home = 'suijia_house';
    }
    // 彻底清洗历史遗留的查账/暗账/高利贷污染线索、差事、约定与承诺
    const auditPollutionRe = /(账册|底账|暗账|税册|沈家账本|私改月息|查账|理账|脏账|高利贷|底档|旧卷房|对清账目|盘账|对好的账|铺账|对出账目|送对清|名讳一处|对清)/;
    if (Array.isArray(raw.clues)) {
      raw.clues = raw.clues.filter((c) => !auditPollutionRe.test(c?.text || c?.desc || ''));
    }
    if (Array.isArray(raw.promises)) {
      raw.promises = raw.promises.filter((p) => !auditPollutionRe.test(p?.text || ''));
    }
    if (Array.isArray(raw.appointments)) {
      raw.appointments = raw.appointments.filter((a) => !auditPollutionRe.test(a?.text || a?.desc || ''));
    }
    if (Array.isArray(raw.tasks)) {
      raw.tasks = raw.tasks.filter((t) => !auditPollutionRe.test(t?.what || ''));
    }
    console.log(`[State] 账本升级到 v${base.stateVersion}：已刷新预设人物欲望与住处，并彻底肃清历史查账污染`);
  }

  const resWorld = {
    ...base,
    ...raw,
    stateVersion: base.stateVersion,
    clock: { ...base.clock, ...(raw.clock || {}) },
    assets: {
      ...base.assets,
      ...(raw.assets || {}),
      properties: Array.isArray(raw.assets?.properties) ? raw.assets.properties : base.assets.properties,
    },
    places: (() => {
      const merged = normalizePlaces({ ...base.places, ...(raw.places || {}) }, mergedActors);
      // 兜底：动态辟建的地点（医馆/雅阁/小茶摊…）不许在加载时凭空消失
      for (const [id, pl] of Object.entries(raw.places || {})) {
        if (!pl || !pl.name || merged[id]) continue;
        const same = Object.entries(merged).find(([, q]) => q && q.name === pl.name);
        if (same) {
          // 同名地点已存在：把站在这里的人改指过去
          for (const a of Object.values(mergedActors)) {
            if (a && a.location === id) a.location = same[0];
          }
        } else {
          merged[id] = pl;
        }
      }
      return merged;
    })(),
    actors: mergedActors,

    pending: Array.isArray(raw.pending) ? raw.pending : base.pending,
    promises: Array.isArray(raw.promises) ? raw.promises : [],
    memories: Array.isArray(raw.memories) ? raw.memories : [],
    calendar: { ...base.calendar, ...(raw.calendar || {}) },
    // 疆域取并集：老存档里的旧地图不能把新道新府盖掉
    geo: (() => {
      const merged = { ...base.geo, ...(raw.geo || {}) };
      const regions = Array.isArray(merged.regions) ? [...merged.regions] : [];
      for (const br of base.geo.regions || []) {
        const hit = regions.find((r) => r?.name === br.name);
        if (!hit) {
          regions.push({ ...br, cities: [...br.cities] });
        } else {
          hit.cities = Array.from(new Set([...(hit.cities || []), ...br.cities]));
        }
      }
      merged.regions = regions;
      return merged;
    })(),
    powers: { ...base.powers, ...(raw.powers || {}) },
    cities: { ...base.cities, ...(raw.cities || {}) },
    military: { ...base.military, ...(raw.military || {}) },
    // 老存档补建：于家酒肆（紫嫣的铺子）
    assets: (() => {
      const a = { ...base.assets, ...(raw.assets || {}) };
      a.properties = Array.isArray(a.properties) ? [...a.properties] : [];
      for (const pr of a.properties) {
        if (!pr) continue;
        if (!pr.owner) pr.owner = pr.keeper || 'husband';
        if (!pr.keeper) continue;
        if (pr.id === 'wine_shop' || pr.name === '于家酒肆' || pr.id === 'yujie_yard') continue;
        pr.keeper = 'husband';
      }
      if (!a.properties.some((x) => x && (x.id === 'wine_shop' || x.name === '于家酒肆'))) {
        a.properties.push({ id: 'wine_shop', name: '于家酒肆', status: '正常营业', incomePerDay: 1.1, keeper: 'liuwenxia', owner: 'liuwenxia', city: '临江府' });
      }
      return a;
    })(),    forces: { ...base.forces, ...(raw.forces || {}) },
    wallets: { ...base.wallets, ...(raw.wallets || {}) },
    allies: { ...base.allies, ...(raw.allies || {}) },
    terrain: Array.isArray(raw.terrain) && raw.terrain.length ? raw.terrain : base.terrain,
    court: (() => {
      const m = { ...base.court, ...(raw.court || {}) };
      m.mandate = { ...base.court.mandate, ...(raw.court?.mandate || {}) };
      m.decisions = Array.isArray(raw.court?.decisions) ? raw.court.decisions : [];
      return m;
    })(),
    reputation: Number.isFinite(Number(raw.reputation)) ? Number(raw.reputation) : 50,
    wanted: Number.isFinite(Number(raw.wanted)) ? Number(raw.wanted) : 0,
    infra: { ...base.infra, ...(raw.infra || {}) },
    factions: { ...base.factions, ...(raw.factions || {}) },
    clues: Array.isArray(raw.clues) ? raw.clues : [],
    appointments: Array.isArray(raw.appointments) ? raw.appointments : [],
    proactive: Array.isArray(raw.proactive) ? raw.proactive : [],
    milestones: Array.isArray(raw.milestones) ? raw.milestones : base.milestones,
    flags: { ...base.flags, ...(raw.flags || {}) },
  };

  // ── 自愈：将分裂的动态子场所归并回主建筑（解决县衙后堂/长街分裂导致的幽灵隔离死锁）──
  try {
    const places = resWorld.places || {};
    const actors = resWorld.actors || {};
    for (const [pid, p] of Object.entries(places)) {
      if (!p || pid === 'yamen' || pid === 'street' || pid === 'tea_house' || pid === 'jiusi' || pid === 'restaurant' || pid === 'jail_male' || pid === 'jail_female' || pid === 'tea_stall') continue;
      const nm = String(p.name || '');
      let targetPid = null;
      if (!/(牢|狱|茶摊)/.test(nm) && /(县衙|后堂|县衙后堂|后院|偏厅)/.test(nm) && places.yamen) targetPid = 'yamen';
      else if (/(长街|青石板|大街)/.test(nm) && places.street) targetPid = 'street';
      else if (/(茶坊|茶楼)/.test(nm) && places.tea_house) targetPid = 'tea_house';
      else if (/(酒楼)/.test(nm) && places.restaurant) targetPid = 'restaurant';
      else if (/(酒肆)/.test(nm) && places.jiusi) targetPid = 'jiusi';

      if (targetPid && targetPid !== pid) {
        for (const [aid, act] of Object.entries(actors)) {
          if (act && act.location === pid) act.location = targetPid;
          if (act && act.home === pid) act.home = targetPid;
        }
        delete places[pid];
      }
    }
  } catch {}

  return resWorld;
}

let __stateBatch = null;

/** 开始批量：这一轮里的 saveState 只记在内存，最后统一写一次盘 */
export function beginStateBatch() {
  __stateBatch = { world: null, dataDir: null };
}

/** 结束批量：把最后一次的世界写盘 */
export function endStateBatch(dataDir) {
  const b = __stateBatch;
  __stateBatch = null;
  if (b && b.world && dataDir) {
    try { saveState(dataDir, b.world); } catch { /* 忽略 */ }
  }
}

export function saveState(dataDir, world) {
  const __turn = __turnAls.getStore();
  if (__turn && !__turn.flushing) {
    __turn.world = world;
    __turn.dataDir = dataDir;
    __turn.dirty = true;
    globalThis.__stateStats.saves += 1;
    return;
  }
  const S = globalThis.__stateStats;
  S.saves += 1;
  const __t0 = Date.now();
  // 批量模式下只记住最后一次，不真的写盘（一轮聊天能少写十几次 1MB）
  if (__stateBatch) {
    __stateBatch.world = world;
    __stateBatch.dataDir = dataDir;
    try {
      __stateCache = { key: path.resolve(statePath(dataDir)), mtime: (__stateCache.mtime || 0), size: (__stateCache.size || 0), world };
    } catch { /* 忽略 */ }
    return;
  }
  // 流水归类：老条目没有 category 的，写盘前补上
  try {
    if (Array.isArray(world.ledger)) {
      for (const e of world.ledger) {
        if (e && !e.category) e.category = moneyCategory(e.title, e.delta);
      }
    }
  } catch { /* 忽略 */ }
  const file = statePath(dataDir);
  fs.mkdirSync(worldDir(dataDir), { recursive: true });
  const tmp = `${file}.tmp`;
  // 不再 pretty-print：省一半体积与序列化时间（线上存档已 1MB+）
  S.writes += 1;
  fs.writeFileSync(tmp, JSON.stringify(world), 'utf8');
  fs.renameSync(tmp, file);

  // 写透缓存：刚存的这份就是最新世界，下次读档直接命中，不必重新解析
  try {
    const st = fs.statSync(file);
    __stateCache = {
      key: path.resolve(file),
      mtime: st.mtimeMs,
      size: st.size,
      world,
    };
  } catch { /* 忽略 */ }
}

/* ── 事件流（append-only）────────────────────────────────── */

export function appendEvents(dataDir, events) {
  if (!Array.isArray(events) || events.length === 0) return;
  const file = eventsPath(dataDir);
  fs.mkdirSync(worldDir(dataDir), { recursive: true });
  fs.appendFileSync(file, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8');

  // 简单轮转：超过 512KB 只保留最后 1500 行，避免无限增长
  try {
    if (fs.statSync(file).size > 512 * 1024) {
      const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-1500);
      fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
    }
  } catch {
    /* 轮转失败不影响主流程 */
  }
}

export function readRecentEvents(dataDir, n = 5) {
  try {
    const raw = fs.readFileSync(eventsPath(dataDir), 'utf8');
    const lines = raw.split('\n').filter(Boolean).slice(-n);
    return lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function nextEvent(world, { actor = 'system', action, place = null, payload = {}, targets = [], isPublic = true }) {
  world.flags.eventSeq = (Number(world.flags.eventSeq) || 0) + 1;
  return {
    seq: world.flags.eventSeq,
    day: world.clock.day,
    hour: world.clock.hour,
    place: place || world.actors?.[actor]?.location || null,
    actor,
    action,
    payload,
    targets,
    public: isPublic,
  };
}

/**
 * 全局统一地点产业事实（唯一事实源）
 * 输入：world 数据快照，placeId 地点标识
 * 输出：客观事实文本（若无产业则返回空串或归属说明）
 */
export function placeFacts(world, placeId) {
  if (!world || !placeId) return '';
  // 1. 健壮解析地点：支持 key、中文名、或 places 遍历
  let place = world.places?.[placeId];
  let actualPlaceId = placeId;
  if (!place) {
    const entry = Object.entries(world.places || {}).find(
      ([k, v]) => k === placeId || v?.name === placeId
    );
    if (entry) {
      actualPlaceId = entry[0];
      place = entry[1];
    }
  }

  const placeName = place?.name || placeId;

  // 2. 匹配产业：支持 placeId、actualPlaceId、prop.id、或中文名称匹配
  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
  const prop = props.find(
    (p) => p && (p.placeId === placeId || p.placeId === actualPlaceId || p.id === placeId || p.id === actualPlaceId || p.name === placeName)
  );

  if (!prop) {
    if (place && place.owner && place.owner !== 'public') {
      const ownerName = world.actors?.[place.owner]?.name || (place.owner === 'husband' ? (world.actors?.husband?.name || '王甯') : place.owner);
      return `【此处归属】「${placeName}」，归【${ownerName}】所有。`;
    }
    return '';
  }

  let ownerName = '官府公产';
  const ownerId = prop.owner || place?.owner;
  if (ownerId === 'husband') {
    ownerName = world.actors?.husband?.name ? `${world.actors.husband.name}（相公）` : '王甯（相公）';
  } else if (ownerId) {
    ownerName = world.actors?.[ownerId]?.name || ownerId;
  }

  // 在岗：以产业名册为真相源；名册为空时才按身份关键词兜底
  const staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
  const onDuty = Object.values(world.actors || {}).filter((a) => {
    if (!a || a.dead) return false;
    const isAt = a.location === placeId || a.location === actualPlaceId || a.location === placeName || world.places?.[a.location]?.name === placeName;
    if (!isAt) return false;
    if (staffIds.length) return staffIds.includes(a.id);
    return a.id === prop.keeper || a.role?.includes('掌柜') || a.role?.includes('伙计') || a.role?.includes('跑堂') || a.role?.includes('厨');
  }).map((a) => `${a.name}（${a.role || '在岗'}）`);

  const staffText = onDuty.length > 0 ? `当前在岗打理：${onDuty.join('、')}。` : (prop.staff ? `在册雇工 ${prop.staff} 人。` : '');
  const statusText = prop.status ? `营生状态：${prop.status}。` : '';

  return `【此处产业事实】铺名：「${prop.name}」，东家：【${ownerName}】。${statusText}${staffText}`;
}
