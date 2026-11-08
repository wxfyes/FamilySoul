/**
 * 全国匪患：不是围着相公刷怪，是各地天灾民怨自己长出来的。
 *
 * 全部本地计算（0 token）：
 *   ① 民怨 ≥50 的城，每月有机会啸聚成匪
 *   ② 官府有兵则剿，无兵则匪越做越大
 *   ③ 三阶匪帮会攻城，破城即割据
 *   ④ 相公可派护院剿匪：缴获、民心、名声、功名
 */

import { factionOf, factionStrength, syncWangjiaToMilitary } from './factions.js';
import { changeCityOwner, troopsAt, setWarEventSink } from './warfare.js';
import { addFame } from './reputation.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * 武勋升迁阶梯：剿匪累功，朝廷按功授官（团练使是起点，之后一阶一阶升）
 * 条件：累计剿平股数 + 名声 + 朝廷关系；官职写在 court.offices，月俸见 clock.js 的 pays 表
 */
export const MILITARY_LADDER = [
  { key: 'shoubei', title: '临江府守备', need: 3, fame: 60, court: -99 },
  { key: 'dusi', title: '临江府都司', need: 6, fame: 75, court: 10 },
  { key: 'canjiang', title: '江淮参将', need: 10, fame: 90, court: 20 },
  { key: 'fuzongbing', title: '副总兵', need: 15, fame: 100, court: 35 },
];

function courtRelOf(world) {
  const c = world?.factions?.court;
  const f = world?.factions?.wangjia;
  return Number(c?.relations?.wangjia ?? f?.relations?.court ?? 0) || 0;
}

/** 下一阶该升什么、差多少（给接口/看板用；已封满返回 null） */
export function nextPromotion(world) {
  const held = world?.court?.offices || {};
  const quelled = Number(world?.flags?.quelledTotal) || 0;
  const fame = Number(world?.actors?.husband?.fame?.value) || 0;
  const court = courtRelOf(world);
  const next = MILITARY_LADDER.find((r) => !held[r.key]);
  if (!next) return null;
  return {
    key: next.key, title: next.title, need: next.need, fame: next.fame, court: next.court,
    quelled, fameNow: fame, courtNow: court,
    ready: quelled >= next.need && fame >= next.fame && court >= next.court,
  };
}

/** 达标就授下一阶；返回授职文案（没升则为空串） */
function maybePromote(world) {
  const n = nextPromotion(world);
  if (!n || !n.ready) return '';
  world.court = world.court || {};
  world.court.offices = world.court.offices || {};
  world.court.offices[n.key] = {
    holder: 'husband',
    title: n.title,
    at: { day: Number(world.clock?.day) || 1 },
    note: `剿匪累功，朝廷叙功授${n.title}`,
  };
  return `，朝廷叙功，升授「${n.title}」`;
}

const LEADERS = ['翻江蛟', '过山虎', '黑面判官', '独眼狼', '铁臂熊', '野狐', '穿山甲', '秃鹫', '一阵风', '活阎王'];
const KINDS = {
  water: { label: '水盗', names: ['水寨', '水盗', '水帮'] },
  mountain: { label: '山寨', names: ['山寨', '黑风寨', '绿林寨', '山匪'] },
  horse: { label: '响马', names: ['响马', '马帮', '游骑'] },
};

export function ensureBandits(world) {
  world.bandits = world.bandits && typeof world.bandits === 'object' ? world.bandits : {};
  return world.bandits;
}

function kindOf(ct) {
  const text = `${ct?.region || ''} ${ct?.name || ''}`;
  if (/江南|运河|淮|水|江|湖/.test(text)) return 'water';
  if (/河北|关内|陇右|辽东|山|塞/.test(text)) return 'horse';
  return 'mountain';
}

export function banditStrengthTotal(world) {
  ensureBandits(world);
  return Object.values(world.bandits).reduce((s, b) => s + num(b?.strength), 0);
}

/** 每月：自然萌生 */
export function maybeSpawnBandits(world, events, nextEvent) {
  ensureBandits(world);
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return [];

  const out = [];
  const disasterToday = (events || []).some((e) => e && e.action === 'disaster');
  const perRegion = {};
  for (const b of Object.values(world.bandits)) {
    if (!b) continue;
    perRegion[b.region || ''] = (perRegion[b.region || ''] || 0) + 1;
  }

  for (const [cityName, ct] of Object.entries(world.cities || {})) {
    if (!ct) continue;
    if (Object.values(world.bandits).some((b) => b && b.homeCity === cityName)) continue;
    if ((perRegion[ct.region || ''] || 0) >= 3) continue;   // 一道最多三股，免得遍地开花

    // 匪不是"民怨到 50 才发生"，是几件事一起：民怨、灾荒、地形、官府兵备
    const rugged = /山|岭|水|湖|泽|关/.test(`${ct.name || ''} ${ct.region || ''}`);
    const weakDefense = num(ct.defense) < 20;
    let chance = 0.05;
    chance += Math.min(0.3, num(ct.unrest) / 200);
    if (disasterToday) chance += 0.15;
    if (rugged) chance += 0.05;
    if (weakDefense) chance += 0.03;
    if (Math.random() > Math.min(0.5, chance)) continue;

    const kind = kindOf(ct);
    const strength = 20 + Math.floor(Math.random() * 30);
    const id = `bandit_${cityName}_${day}_${Math.floor(Math.random() * 1000)}`;
    const leader = pick(LEADERS);
    world.bandits[id] = {
      id,
      name: `${cityName}${pick(KINDS[kind].names)}`,
      kind,
      region: ct.region || '',
      homeCity: cityName,
      leader,
      strength,
      tier: 1,
      silver: Math.round(strength * 0.5 * 100) / 100,
      grain: Math.round(strength * 1.2 * 100) / 100,
      infamy: 20 + Math.floor(Math.random() * 20),
      createdDay: day,
    };
    out.push({ action: 'bandits_spawn', actor: 'system', place: ct.region || null,
      payload: { text: `${cityName}民怨沸腾，${leader}聚众成匪，号「${world.bandits[id].name}」` }, isPublic: true });
  }
  for (const e of out) events?.push(nextEvent(world, e));
  return out;
}

/** 每月：匪患演变与官兵围剿 */
export function runBanditEcosystem(world, events, nextEvent) {
  ensureBandits(world);
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return [];
  const out = [];

  for (const b of Object.values(world.bandits)) {
    if (!b) continue;
    const ct = world.cities?.[b.homeCity];
    if (!ct) continue;

    // 匪帮坐大：城民怨越高，长得越快
    const grow = Math.max(1, Math.round(num(ct.unrest) / 10));
    b.strength = Math.round(num(b.strength) + grow);
    b.silver = round2(num(b.silver) + grow * 0.4);
    b.grain = round2(num(b.grain) + grow * 0.8);
    b.infamy = Math.min(100, num(b.infamy) + 2);
    b.tier = b.strength >= 200 ? 3 : b.strength >= 50 ? 2 : 1;

    // 一阶：商道受损（城价上浮）；二阶：民怨自增
    if (b.tier >= 1) {
      try { ct.price = Math.min(300, Math.round(num(ct.price) * 1.02)); } catch { /* 忽略 */ }
    }
    if (b.tier >= 2) {
      ct.unrest = Math.min(100, num(ct.unrest) + 3);
    }

    // 官军围剿：该城归属势力若驻军 ≥ 匪力 1.5 倍
    const owner = String(ct.owner || 'court');
    const f = factionOf(world, owner);
    const garrison = f ? troopsAt(world, f, b.homeCity) : 0;
    if (f && garrison >= num(b.strength) * 1.5) {
      const power = factionStrength(world, f);
      if (power > num(b.strength) * 1.2) {
        delete world.bandits[b.id];
        ct.unrest = Math.max(0, num(ct.unrest) - 10);
        out.push({ action: 'bandits_quelled', actor: 'court', place: b.homeCity,
          payload: { text: `【官兵剿匪】${b.homeCity}守军剿平「${b.name}」，地方复归安宁` }, isPublic: true });
        continue;
      }
    }

    // 三阶：攻打城防薄弱的城
    if (b.tier >= 3 && num(ct.defense) < 25 && Math.random() < 0.35) {
      if (num(b.strength) > num(ct.defense) * 6) {
        changeCityOwner(world, b.homeCity, 'bandit');
        world.factions = world.factions || {};
        world.factions.bandit = world.factions.bandit || {
          id: 'bandit', name: '绿林群匪', kind: 'warlord', leader: null,
          cities: [], troops: 0, stationed: {}, grain: 0, morale: 50, ambition: 90, stance: 'expand', relations: {},
        };
        out.push({ action: 'bandits_take_city', actor: 'system', place: b.homeCity,
          payload: { text: `${b.name}攻破${b.homeCity}，聚众据城，官府震动` }, isPublic: true });
      }
    }
  }
  for (const e of out) events?.push(nextEvent(world, e));
  return out;
}

/**
 * 相公剿匪：从某个城派的兵去打
 * @returns {{ok:boolean, error?:string, win?:boolean, lootSilver?:number, lootGrain?:number}}
 */
export function quellBandits(world, banditId, troops, fromCity) {
  ensureBandits(world);
  const b = world.bandits[banditId];
  if (!b) return { ok: false, error: '没有这股匪' };
  const f = factionOf(world, 'wangjia');
  if (!f) return { ok: false, error: '没有王家势力' };
  const city = fromCity && world.cities?.[fromCity] ? fromCity : (Object.keys(f.stationed || {})[0] || '');

  // 可派的人 = 营兵（出征） + 府里的护院/家丁（平民也能带出去打匪，募护院不犯法）
  const armyHere = troopsAt(world, f, city);
  const kinds = f.kinds || {};
  const retainerHave = Math.max(0, Math.round(num(kinds.retainer)));
  const guardHave = Math.max(0, Math.round(num(kinds.guard)));
  const available = armyHere + retainerHave + guardHave;
  const asked = Math.round(num(troops));
  const send = Math.min(asked > 0 ? asked : available, available);
  if (send < 1) return { ok: false, error: '你手头没有可带的人手（营兵 / 护院 / 家丁）' };

  // 先出营兵，再出护院，最后家丁
  let need = send;
  const fromArmy = Math.min(need, armyHere); need -= fromArmy;
  const fromRetainer = Math.min(need, retainerHave); need -= fromRetainer;
  const fromGuard = Math.min(need, guardHave); need -= fromGuard;

  // 战力：营兵按 factionStrength 折（含新兵/训练/装备），护院约七成、家丁约四成五
  const q = Math.max(10, Math.min(120, num(world.military?.quality) || 50));
  const morale = Math.max(10, Math.min(120, num(f.morale) || 50));
  const baseMan = 0.9 * (q / 50) * (0.6 + morale / 100) * 0.7;
  const armyMan = armyHere > 0 ? Math.max(baseMan, factionStrength(world, f) / Math.max(1, armyHere)) : 0;
  const power = fromArmy * armyMan + fromRetainer * baseMan * 0.7 + fromGuard * baseMan * 0.45;
  const foe = num(b.strength) * (b.tier >= 3 ? 1.3 : b.tier === 2 ? 1.1 : 1);
  const win = power * (0.85 + Math.random() * 0.4) > foe;

  // 伤亡：先扣营兵，再扣护院，最后家丁
  const loss = Math.round(send * (win ? 0.05 + Math.random() * 0.1 : 0.25 + Math.random() * 0.15));
  let cut = loss;
  const cutArmy = Math.min(cut, fromArmy); cut -= cutArmy;
  const cutRetainer = Math.min(cut, fromRetainer); cut -= cutRetainer;
  const cutGuard = Math.min(cut, fromGuard);
  f.stationed[city] = Math.max(0, armyHere - cutArmy);
  kinds.retainer = Math.max(0, retainerHave - cutRetainer);
  kinds.guard = Math.max(0, guardHave - cutGuard);
  f.kinds = kinds;
  f.troops = Object.values(f.stationed).reduce((x, y) => x + num(y), 0);
  try { syncWangjiaToMilitary(world); } catch { /* 忽略 */ }

  const day = Number(world.clock?.day) || 1;
  const hour = Number(world.clock?.hour) || 0;

  if (!win) {
    world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
    return { ok: true, win: false, error: null, loss, name: b.name, city: b.homeCity, text: `攻${b.name}不利，折兵 ${loss} 人` };
  }

  // 剿平：钱粮兵马都归相公
  const lootSilver = round2(num(b.silver));
  const lootGrain = round2(num(b.grain));
  delete world.bandits[banditId];
  world.assets.silver = round2(num(world.assets.silver) + lootSilver);
  // 粮不再充公，入王家随军粮
  f.grain = round2(num(f.grain) + lootGrain);
  const ct = world.cities?.[b.homeCity];
  if (ct) ct.unrest = Math.max(0, num(ct.unrest) - 20);
  // 降卒：匪众里愿意归顺的，编入王家（有朝命编为营兵，白身编为家丁）
  const captured = Math.max(0, Math.round(num(b.strength) * 0.25));
  if (captured > 0) {
    const hasOffice = Object.values(world.court?.offices || {}).some((o) => o && String(o.holder || '') === 'husband');
    if (hasOffice) {
      const cur = troopsAt(world, f, city);
      f.stationed[city] = Math.max(0, cur) + captured;
    } else {
      f.kinds = f.kinds || {};
      f.kinds.guard = Math.round(num(f.kinds.guard) + captured);
    }
    f.troops = Object.values(f.stationed || {}).reduce((x, y) => x + num(y), 0);
    try { syncWangjiaToMilitary(world); } catch { /* 忽略 */ }
  }
  addFame(world, 'husband', 25, '义士');
  // 缴获进账本（流水里能看见，银与粮都记）
  if (lootSilver > 0 || lootGrain > 0 || captured > 0) {
    world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
    world.ledger.push({
      day, hour, delta: lootSilver, grain: lootGrain, troops: captured,
      title: `剿平${b.name}·缴获`, by: 'husband', balance: world.assets.silver, category: '剿匪缴获',
    });
  }

  // 功名：剿匪大胜 → 团练使
  world.court = world.court || {};
  world.court.offices = world.court.offices || {};
  let appoint = '';
  if (!world.court.offices.tuanlian) {
    world.court.offices.tuanlian = {
      holder: 'husband',
      title: '临江府乡勇团练使',
      at: { day: Number(world.clock?.day) || 1 },
      note: '剿匪有功，知府奏请授职',
    };
    appoint = '，知府感念忠勇，授「临江府乡勇团练使」';
  }

  // 累功：剿平股数 + 升迁判定（守备→都司→参将→副总兵）
  world.flags = world.flags || {};
  world.flags.quelledTotal = Math.round(Number(world.flags.quelledTotal) || 0) + 1;
  // 剿匪叙功：朝中关系缓慢积累（都司/参将要看它，不能永远卡在 0）
  try {
    world.factions = world.factions || {};
    world.factions.court = world.factions.court || {};
    world.factions.court.relations = world.factions.court.relations || {};
    const cr = Number(world.factions.court.relations.wangjia) || 0;
    // 一股 +5：都司（6 股/朝中10）约两股可达，参将/副总兵也都有台阶
    world.factions.court.relations.wangjia = Math.min(100, cr + 5);
  } catch { /* 忽略 */ }
  const promo = maybePromote(world);
  if (promo) appoint += promo;

  return {
    ok: true,
    win: true,
    loss,
    name: b.name,
    city: b.homeCity,
    lootSilver,
    lootGrain,
    captured,
    quelledTotal: world.flags.quelledTotal,
    appoint: appoint || '',
    text: `剿平「${b.name}」，缴银 ${lootSilver} 两、粮 ${lootGrain} 石（入随军粮）${captured > 0 ? `，收降卒 ${captured} 人` : ''}${loss > 0 ? `，折兵 ${loss} 人` : ''}，民心大振${appoint}`,
  };
}

/**
 * 手造一股匪（验收/剧情用）：指定城、兵力、阶位
 * @returns {object} 新匪对象
 */
export function spawnBandit(world, { city = '临江府', strength = 8, tier = 1, name = '' } = {}) {
  ensureBandits(world);
  const cityName = String(city || '临江府');
  const ct = world.cities?.[cityName] || { region: '江南道', name: cityName };
  const kind = kindOf(ct);
  const st = Math.max(3, Math.round(num(strength)));
  const day = Number(world.clock?.day) || 1;
  const id = `bandit_${cityName}_${day}_${Math.floor(Math.random() * 100000)}`;
  const leader = pick(LEADERS);
  const nm = name || `${cityName}${pick(KINDS[kind].names)}`;
  world.bandits[id] = {
    id,
    name: nm,
    kind,
    region: ct.region || '',
    homeCity: cityName,
    leader,
    strength: st,
    tier: Math.max(1, Math.min(3, Math.round(num(tier)))),
    silver: Math.round(st * 0.5 * 100) / 100,
    grain: Math.round(st * 1.2 * 100) / 100,
    infamy: 20 + Math.floor(Math.random() * 20),
    createdDay: day,
  };
  return world.bandits[id];
}
