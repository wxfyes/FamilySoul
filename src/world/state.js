/**
 * 世界状态层 —— 唯一真相源
 *
 * 只用纯规则读写，不调用任何大模型。
 * 所有数据结构见 docs/world-engine.md 第 3、4 节。
 */
import fs from 'node:fs';
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
        id: 'xiaocui', gender: 'female', home: 'backyard',
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
        id: 'aji', gender: 'male', home: 'tea_house', schedule: [{ at: 6, do: '开门生火、擦桌摆盏', place: 'tea_house' }, { at: 12, do: '往前街送茶点', place: 'street' }, { at: 18, do: '回茶坊收档', place: 'tea_house' }],
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
    stateVersion: 2,
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
