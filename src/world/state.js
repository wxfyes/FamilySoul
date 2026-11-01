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
        id: 'waner',
        name: '沈婉儿',
        role: '正妻',
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
        id: 'yunnia',
        name: '林芸娘',
        role: '二房如夫人',
        location: 'backyard',
        goals: ['把柜台生意学精', '不给姐姐添乱'],
        relations: {
          husband: { trust: 63, desire: 66, fear: 4, grievance: 0 },
        },
        intimacy: { level: 2, tone: 0, lastAt: 0, ritual: 'solemn' },
        schedule: [{ at: 8, do: '在前街学看柜', place: 'tea_house' }],
      },
      xiaocui: {
        id: 'xiaocui',
        name: '小翠',
        role: '贴身丫鬟',
        location: 'backyard',
        goals: ['把差事办利索', '讨大娘子点头开脸'],
        relations: { husband: { trust: 60, desire: 40, fear: 1, grievance: 0 } },
      },
      aji: {
        id: 'aji',
        name: '阿吉',
        role: '跑堂伙计',
        location: 'tea_house',
        goals: ['把跑堂差事做出名堂'],
      },
      qiantonghai: {
        id: 'qiantonghai',
        name: '钱通海',
        role: '临江茶行行长',
        location: 'street',
        goals: ['夺下紫阳山头春茶'],
        secret: '暗中与巡检徐老虎分成',
        relations: {
          husband: { trust: 10, desire: 0, fear: 0, grievance: 45 },
        },
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
  return {
    ...base,
    ...raw,
    clock: { ...base.clock, ...(raw.clock || {}) },
    assets: {
      ...base.assets,
      ...(raw.assets || {}),
      properties: Array.isArray(raw.assets?.properties) ? raw.assets.properties : base.assets.properties,
    },
    places: { ...base.places, ...(raw.places || {}) },
    actors: { ...base.actors, ...(raw.actors || {}) },
    pending: Array.isArray(raw.pending) ? raw.pending : base.pending,
    promises: Array.isArray(raw.promises) ? raw.promises : [],
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
