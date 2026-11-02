/**
 * 世界状态层 —— 唯一真相源
 *
 * 只用纯规则读写，不调用任何大模型。
 * 所有数据结构见 docs/world-engine.md 第 3、4 节。
 */
import fs from 'node:fs';
import { lunarFromTable } from './lunar-table.js';
import path from 'node:path';

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
        { id: 'tea_house', name: '临江茶坊老店', status: '正常营业', incomePerDay: 1.2 },
        {
          id: 'canal_restaurant',
          name: '运河码头三层大酒楼',
          status: '筹备开张',
          incomePerDay: 0,
          costSilver: 510,
        },
      ],
    },

    places: {
      tea_house: { name: '临江茶坊', exits: ['street', 'backyard'] },
      backyard: { name: '后院暖阁', exits: ['tea_house'] },
      wine_shop: { name: '于家酒肆', exits: ['street'], dynamic: false },
      goods_shop: { name: '翟家货栈', exits: ['street'], dynamic: false },
      street: { name: '青石板长街', exits: ['tea_house', 'yamen'] },
      dock: { name: '运河码头', exits: ['street', 'canal_restaurant'] },
      canal_restaurant: { name: '运河码头大酒楼', exits: ['dock'] },
      yang_mansion: { name: '杨府', exits: ['street'] },
      yamen: { name: '临江县衙', exits: ['street'] },
    },

    actors: {
      husband: {
        id: 'husband',
        name: '王甯',
        role: '相公',
        playerControlled: true,
        location: 'tea_house',
        relations: {},
        intimacy: {},
      },
      waner: {
        id: 'waner', gender: 'female', home: 'backyard',
        name: '沈婉儿',
        role: '正妻',
        label: '正妻',
        household: true,
        location: 'tea_house',
        goals: ['保住王家体面', '把运河大酒楼盘活', '为相公张罗一房稳妥的侧室'],
        secret: '沈家旧案还有一份未烧尽的账册压在知府衙门的旧档里',
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
        goals: ['把柜台生意学精', '不给姐姐添乱'],
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
        role: '贴身丫鬟',
        label: '丫鬟',
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
        goals: ['撑住翟家货栈的门面', '等一个能说心里话的人'],
        secret: '手里攥着翟家货栈的底价暗账',
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
        id: 'liuwenxia', gender: 'female', home: 'wine_shop',
        name: '刘文霞',
        role: '于家酒肆老板娘',
        location: 'street',
        goals: ['把酒肆的茶酒生意做起来', '不在人前露出半分委屈'],
        secret: '丈夫于杰欠下画舫一笔账，她在悄悄填补',
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
        id: 'zhanjing', gender: 'female', home: 'yamen',
        name: '战静',
        role: '县衙书吏发妻',
        location: 'street',
        goals: ['守住自己的体面', '替娘家争一口气'],
        secret: '抄录了一份县衙里说不清的税册',
        relations: {
          husband: { trust: 42, desire: 26, fear: 3, grievance: 14 },
        },
        intimacy: { level: 1, tone: 0, lastAt: 0, ritual: 'solemn' },
        schedule: [
          { at: 6, do: '去慈云庵进香', place: 'yamen' },
          { at: 9, do: '回家理事', place: 'street' },
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
    stateVersion: 4,
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
    // 名声与通缉：士绅口碑 / 官府悬赏
    reputation: 50,
    wanted: 0,
    // 天下势力：朝廷、藩镇、义军、商帮、山匪
    powers: {
      court: { name: '大乾朝廷', kind: '朝廷', power: 90, relation: 0, troops: 200000, note: '名义上统御天下' },
      wangjia: { name: '王家', kind: '商帮', power: 5, relation: 100, troops: 0, note: '你自己' },
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

export function ensureCourt(world) {
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
      world.actors[id] = {
        id,
        name: cityOfficialName(cityName),
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
        home: world.places?.['yamen'] ? 'yamen' : 'street',
        location: 'yamen',
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

export function loadState(dataDir) {
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
  const mergedActors = { ...base.actors };
  for (const [id, actor] of Object.entries(raw.actors || {})) {
    mergedActors[id] = { ...(base.actors?.[id] || {}), ...actor };
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
    }
    console.log(`[State] 账本升级到 v${base.stateVersion}：已刷新 ${Object.keys(base.actors || {}).length} 位预设人物的日程与住处`);
  }

  return {
    ...base,
    ...raw,
    stateVersion: base.stateVersion,
    clock: { ...base.clock, ...(raw.clock || {}) },
    assets: {
      ...base.assets,
      ...(raw.assets || {}),
      properties: Array.isArray(raw.assets?.properties) ? raw.assets.properties : base.assets.properties,
    },
    places: normalizePlaces({ ...base.places, ...(raw.places || {}) }, mergedActors),
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
    forces: { ...base.forces, ...(raw.forces || {}) },
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
}

export function saveState(dataDir, world) {
  const file = statePath(dataDir);
  fs.mkdirSync(worldDir(dataDir), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(world, null, 2), 'utf8');
  fs.renameSync(tmp, file);
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
