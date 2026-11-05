/**
 * 人口流动 v2：由事出人，人来由天道定名。
 *
 * 引擎只登记"发生了什么"：
 *   { 缘由、行当、性别、大致年岁、带多少钱、落脚何处 }
 * 天道负责：他/她叫什么、什么来历、跟谁有旧（命名与背景）
 *
 * 若连日没有天道应答（无 LLM 或失败），引擎才用最朴素的方式给个名字把人落下，
 * 不至于让"来了人却查无此人"。
 */

import { inferMaritalStatus } from './persona.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const FALLBACK_SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕施张孔曹严华金魏陶姜谢邹苏潘葛范彭鲁韦马苗方俞任袁柳史唐薛雷贺倪汤罗毕郝安常傅康伍余顾孟黄萧尹姚邵汪毛戴宋庞熊纪舒屈项祝董梁杜阮蓝季贾江童颜郭梅盛林钟徐邱骆高夏蔡田樊胡凌霍虞万卢'.split('');
const FALLBACK_F = ['姑', '娘', '妇', '婆', '姐', '妹', '兰', '荷', '桃', '杏'];
const FALLBACK_M = ['郎', '汉', '生', '哥', '叔', '伯', '山', '河', '石', '木'];

const CAUSES = {
  refugee: { place: 'temple', label: '逃荒', money: [0.05, 0.3], age: [18, 55] },
  worker: { place: 'street', label: '投工', money: [0.3, 1.5], age: [16, 35] },
  merchant: { place: 'inn', label: '行商', money: [5, 15], age: [25, 55] },
  bride: { place: 'inn', label: '投亲', money: [0.5, 2], age: [16, 24] },
};

const ROLE_BY_CAUSE = {
  refugee: ['逃荒来的妇人', '带孩子的流民', '逃荒的汉子', '流落此地的老妇'],
  worker: ['绣坊帮工', '酒肆帮佣', '医馆学徒', '脚夫', '货郎', '书铺学徒'],
  merchant: ['行商', '贩布的客商', '收山货的行商', '贩盐的客商'],
  bride: ['投亲的姑娘', '嫁到城里的新妇', '随兄嫂迁来的姑娘'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);

/** 登记一个"将要来的人"（不建角色，等天道定名） */
export function queueMigrant(world, { cause, role, gender, landing }) {
  world.pendingMigrants = Array.isArray(world.pendingMigrants) ? world.pendingMigrants : [];
  const c = CAUSES[cause] || CAUSES.worker;
  world.pendingMigrants.push({
    id: `pm_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    cause,
    role: role || pick(ROLE_BY_CAUSE[cause] || ROLE_BY_CAUSE.worker),
    gender,
    age: Math.round(rand(c.age[0], c.age[1])),
    money: Math.round(rand(c.money[0], c.money[1]) * 100) / 100,
    landing: landing || c.place,
    city: Object.keys(world.cities || {})[0] || null,
    day: Number(world.clock?.day) || 1,
    asked: false,
  });
  // 只保留最近 40 条，避免无限堆积
  world.pendingMigrants = world.pendingMigrants.slice(-40);
  return world.pendingMigrants[world.pendingMigrants.length - 1];
}

/** 引擎兜底：没等到天道，也得把人落下（名字最朴素） */
export function fallbackName(world, gender) {
  for (let i = 0; i < 8; i += 1) {
    const n = `${pick(FALLBACK_SURNAMES)}${pick(gender === 'female' ? FALLBACK_F : FALLBACK_M)}`;
    if (!Object.values(world.actors || {}).some((a) => a && a.name === n)) return n;
  }
  return null;
}

/** 真正把人写进世界（由天道定名后调用，或兜底时调用） */
export function materializeMigrant(world, pm, { name, age, background } = {}) {
  const gender = pm.gender === 'female' ? 'female' : 'male';
  const taken = (n) => Object.values(world.actors || {}).some((a) => a && a.name === n);

  // 名字冲突不许卡死：顺位补字（李四 → 李四郎 / 李四娘 / 李四氏 / 李四哥）
  const suffixes = gender === 'female' ? ['娘', '氏', '姐', '姑'] : ['郎', '哥', '生', '二'];
  let nm = String(name || '').trim();
  if (!nm || taken(nm)) {
    const base = nm || fallbackName(world, gender) || '';
    nm = base;
    if (!nm || taken(nm)) {
      for (const suf of suffixes) {
        const cand = `${base}${suf}`;
        if (!taken(cand)) { nm = cand; break; }
      }
    }
    if (!nm || taken(nm)) {
      for (let i = 0; i < 10; i += 1) {
        const cand = fallbackName(world, gender);
        if (cand && !taken(cand)) { nm = cand; break; }
      }
    }
  }
  if (!nm || taken(nm)) return null;   // 真的取不出名字才放弃（下轮会再试）

  const id = `npc_mig_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const landingPlace = pm.landing && world.places?.[pm.landing] ? pm.landing : 'street';
  world.actors[id] = {
    id,
    name: nm,
    role: pm.role,
    gender: pm.gender === 'female' ? 'female' : 'male',
    age: Number(age) || Number(pm.age) || 25,
    money: Number(pm.money) || 0.5,
    home: landingPlace,
    location: landingPlace,
    marital: inferMaritalStatus(nm, pm.role, Number(age) || Number(pm.age) || 25, gender),
    origin: 'spawned',
    background: background ? String(background).slice(0, 120) : undefined,
    cause: pm.cause,
    relations: { husband: { trust: 10, desire: 0, fear: 0, grievance: 0 } },
    schedule: [],
    createdDay: Number(world.clock?.day) || 1,
  };
  return world.actors[id];
}

/**
 * 每月人口流动：只登记"有人要来"，具体是谁由天道定。
 */
export function runMigration(world, nextEvent, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return { queued: [], reasons: [] };

  const queued = [];
  const reasons = [];

  // ① 邻道灾荒 → 逃荒流民（按严重程度：灾荒次数越多，来的人越多）
  const recent = (events || []).filter((e) => e && e.action === 'disaster').length;
  const severity = Math.min(4, recent);
  if (severity > 0) {
    for (let i = 0; i < severity; i += 1) {
      const gender = Math.random() < 0.6 ? 'female' : 'male';
      queued.push(queueMigrant(world, { cause: 'refugee', gender }));
    }
    reasons.push(`邻道灾荒 ${severity} 起，逃荒的人陆续进城`);
  }

  // ② 招工：自家产业越多，来投工的人越多（不掷概率）
  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
  const hiring = props.filter((p) => p && Number(p.staff || 0) < 3).length;
  if (props.length >= 2 && hiring > 0) {
    const n = Math.min(2, Math.ceil(hiring / 2));
    for (let i = 0; i < n; i += 1) {
      const gender = Math.random() < 0.6 ? 'female' : 'male';
      queued.push(queueMigrant(world, { cause: 'worker', gender }));
    }
    reasons.push(`${hiring} 处铺子缺人手，外乡来投工`);
  }

  // ③ 商路：城富庶且民心安稳 → 行商按月必来（不是概率）
  const goodCities = Object.values(world.cities || {}).filter((ct) => ct && num(ct.wealth) >= 55 && num(ct.unrest) <= 30);
  if (goodCities.length) {
    queued.push(queueMigrant(world, { cause: 'merchant', gender: 'male' }));
    reasons.push('商路太平，行商往来');
  }

  // ④ 投亲嫁娶：全城太平，每季一次（day % 90 === 0）
  const peaceful = Object.values(world.cities || {}).every((ct) => !ct || num(ct.unrest) <= 35);
  if (peaceful && day % 90 === 0) {
    queued.push(queueMigrant(world, { cause: 'bride', gender: 'female' }));
    reasons.push('城里太平，有姑娘投亲嫁进来');
  }

  if (queued.length) {
    events?.push(nextEvent(world, {
      action: 'migrant_incoming', actor: 'system', place: null,
      payload: { text: `${reasons.join('；')}（共 ${queued.length} 人，待入籍）` },
      isPublic: true,
    }));
  }
  return { queued, reasons };
}

/** 落脚：登记时给了落脚处，落下后安家；过了 #{days} 天还没着落的，自己找地方 */
export function settleMigrants(world, events, nextEvent) {
  const day = Number(world.clock?.day) || 1;
  const out = [];
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || !a.cause) continue;
    if (a.settled) continue;
    if (day - num(a.createdDay) < 3) continue;
    // 三天后自寻住处：商旅住店，其他人渐渐在街上安身
    if (!a.home || a.home === 'street' || a.home === 'inn' || a.home === 'temple') {
      a.home = a.home || 'street';
    }
    a.settled = true;
    out.push({ action: 'migrant_settled', actor: a.id, place: a.home, payload: { text: `${a.name}在城里落下脚来` } });
  }
  return out;
}
