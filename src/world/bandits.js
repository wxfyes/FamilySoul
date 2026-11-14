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
import { addRumor } from './rumors.js';
import { ensureOfficialCredentials } from './items.js';
import { addMemory } from './memory.js';

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
  { key: 'fuzongbing', title: '江北副总兵', need: 15, fame: 100, court: 35 },
  { key: 'zongbing', title: '镇守两淮总兵官', need: 20, fame: 100, court: 50 },
  { key: 'tiduzongbing', title: '江南水陆提督总兵官', need: 26, fame: 100, court: 65 },
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

/** 达标就授下一阶；自动核发正式兵部告身敕牒与虎符官印入随身行囊，并昭告全城 */
function maybePromote(world) {
  const n = nextPromotion(world);
  if (!n || !n.ready) return '';
  const day = Number(world.clock?.day) || 1;
  world.court = world.court || {};
  world.court.offices = world.court.offices || {};

  // 1. 升迁交割：将此前相公持有的低阶武职在 court.offices 中正常交割卸任，只保留现任最高职衔
  for (const prev of MILITARY_LADDER) {
    if (prev.key !== n.key && world.court.offices[prev.key] && world.court.offices[prev.key].holder === 'husband') {
      world.court.offices[prev.key].holder = null;
      world.court.offices[prev.key].formerHolder = 'husband';
      world.court.offices[prev.key].vacant = true;
      world.court.offices[prev.key].note = `相公已奉旨升迁${n.title}，原职已交割开缺`;
    }
  }
  if (world.court.offices.tuanlian && world.court.offices.tuanlian.holder === 'husband' && n.key !== 'tuanlian') {
    world.court.offices.tuanlian.holder = null;
    world.court.offices.tuanlian.formerHolder = 'husband';
    world.court.offices.tuanlian.vacant = true;
    world.court.offices.tuanlian.note = `相公已奉旨升任${n.title}，团练使原职已交割开缺`;
  }

  // 2. 实授新职
  world.court.offices[n.key] = {
    holder: 'husband',
    title: n.title,
    at: { day },
    note: `剿匪累功，朝廷叙功实授${n.title}`,
  };
  // 核发兵部正式告身敕牒与虎符官印入随身行囊
  let credNames = '';
  try {
    const newCreds = ensureOfficialCredentials(world);
    if (newCreds && newCreds.length > 0) {
      credNames = `，钦颁《${newCreds.map((c) => c.name).join('》《')}》已收入随身行囊`;
    }
  } catch { /* 忽略 */ }
  // 记入永久核心记忆与大事记
  try {
    addMemory(world, {
      text: `第${day}日，朝廷兵部武选司叙剿匪大功，正式实授相公王甯为「${n.title}」${credNames}，合城官绅百姓人人敬仰。`,
      about: ['husband', 'waner', 'yangshenzhi'],
      visible: 'public',
      kind: 'major',
      day,
    });
    world.milestones = Array.isArray(world.milestones) ? world.milestones : [];
    const msText = `【朝廷叙功实授·${n.title}】王甯率部屡平巨寇，兵部武选司下达正式勘合敕牒与虎符官印，实授「${n.title}」，名震江淮。`;
    if (!world.milestones.some((m) => String(m).includes(n.title))) {
      world.milestones.push(msText);
    }
    addRumor(world, {
      text: `朝廷兵部快马传旨临江，叙王家剿匪平乱大功，实授王甯为「${n.title}」，钦颁兵部敕牒与虎符官印，满城官绅轰动道贺`,
      tone: 1, weight: 9, reach: 95,
    });
  } catch { /* 忽略 */ }
  return `，朝廷兵部叙功升授「${n.title}」${credNames}`;
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

  // 选出兵驻地：若指定城有驻兵则用指定城，否则自动从王家兵马最盛的驻地（如临江府大营）点兵跨府出征
  let city = (fromCity && world.cities?.[fromCity] && troopsAt(world, f, fromCity) > 0) ? fromCity : '';
  if (!city) {
    const stationedEntries = Object.entries(f.stationed || {})
      .filter(([, n]) => num(n) > 0)
      .sort((x, y) => num(y[1]) - num(x[1]));
    city = stationedEntries[0]?.[0] || (fromCity && world.cities?.[fromCity] ? fromCity : (Object.keys(f.stationed || {})[0] || '临江府'));
  }

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
  const foe = num(b.strength) * (b.tier >= 3 ? 1.25 : b.tier === 2 ? 1.1 : 1);
  const win = power * (0.9 + Math.random() * 0.35) > foe;

  // 伤亡：先扣营兵，再扣护院，最后家丁
  const loss = Math.round(send * (win ? 0.03 + Math.random() * 0.06 : 0.2 + Math.random() * 0.12));
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
  const banditTier = Math.max(1, Math.min(3, Math.round(num(b.tier) || 1)));
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

  // 全城通报：剿平当日就传遍街面（不等第二天慢慢扩散）
  try {
    addRumor(world, {
      text: `王家剿平「${b.name}」，缴获颇丰，城中人心大定`,
      tone: 1, weight: 6, reach: 60,
    });
  } catch { /* 忽略 */ }

  // 累功：按匪患阶位计功（一阶1功、二阶2功、三阶巨寇3功）+ 升迁判定（守备→都司→参将→副总兵→总兵→提督）
  const quelledGain = banditTier >= 3 ? 3 : (banditTier === 2 ? 2 : 1);
  const courtGain = banditTier >= 3 ? 12 : (banditTier === 2 ? 8 : 5);
  world.flags = world.flags || {};
  world.flags.quelledTotal = Math.round(Number(world.flags.quelledTotal) || 0) + quelledGain;
  // 剿匪叙功：朝中关系积累
  try {
    world.factions = world.factions || {};
    world.factions.court = world.factions.court || {};
    world.factions.court.relations = world.factions.court.relations || {};
    const cr = Number(world.factions.court.relations.wangjia) || 0;
    world.factions.court.relations.wangjia = Math.min(100, cr + courtGain);
  } catch { /* 忽略 */ }

  // 支持连升并即时核发正式告身敕牒与虎符官印入随身行囊
  for (let step = 0; step < 3; step += 1) {
    const promo = maybePromote(world);
    if (!promo) break;
    appoint += promo;
  }
  try { ensureOfficialCredentials(world); } catch { /* 忽略 */ }

  // 若余寇已少（且处于完整世界），自动涌现新一批江淮流寇山匪供相公继续征讨升迁
  try {
    if (Object.keys(world.cities || {}).length >= 3 && Object.keys(world.bandits || {}).length < 4) {
      ensureActiveBanditWaves(world, 5);
    }
  } catch { /* 忽略 */ }

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
 * 江淮/江南多波次匪患常备池：确保相公随时有多股一阶、二阶、三阶鲜活匪患可出征讨伐、立功升官
 */
const BANDIT_WAVE_TEMPLATES = [
  { city: '临江府', name: '临江黑风岭悍匪', leader: '过山虎', strength: 42, tier: 1, silver: 38, grain: 65 },
  { city: '临江府', name: '芦苇荡翻江水寨', leader: '翻江蛟', strength: 68, tier: 2, silver: 65, grain: 110 },
  { city: '扬州府', name: '高邮湖连环水盗', leader: '独眼狼', strength: 85, tier: 2, silver: 88, grain: 145 },
  { city: '苏州府', name: '太湖七十二峰水帮', leader: '黑面判官', strength: 96, tier: 2, silver: 105, grain: 160 },
  { city: '淮安府', name: '洪泽湖铁索水寨', leader: '铁臂熊', strength: 135, tier: 3, silver: 150, grain: 220 },
  { city: '庐州府', name: '大别山流寇马帮', leader: '活阎王', strength: 155, tier: 3, silver: 175, grain: 260 },
  { city: '应天府', name: '采石矶江盗水帮', leader: '穿山甲', strength: 58, tier: 2, silver: 56, grain: 95 },
  { city: '杭州府', name: '天目山绿林山寨', leader: '一阵风', strength: 48, tier: 1, silver: 45, grain: 80 },
];

export function ensureActiveBanditWaves(world, minCount = 5) {
  ensureBandits(world);
  const existing = Object.values(world.bandits).filter(Boolean);
  if (existing.length >= minCount) return existing;

  const existingNames = new Set(existing.map((b) => b.name));
  const day = Number(world.clock?.day) || 1;
  let seq = 1;

  for (const tpl of BANDIT_WAVE_TEMPLATES) {
    if (Object.keys(world.bandits).length >= Math.max(minCount, 6)) break;
    if (existingNames.has(tpl.name)) continue;
    const cityName = world.cities?.[tpl.city] ? tpl.city : (Object.keys(world.cities || {})[0] || '临江府');
    const ct = world.cities?.[cityName] || { region: '江南道', name: cityName };
    const id = `bandit_wave_${day}_${seq++}_${Math.floor(Math.random() * 9000 + 1000)}`;
    world.bandits[id] = {
      id,
      name: tpl.name,
      kind: kindOf(ct),
      region: ct.region || '江南道',
      homeCity: cityName,
      leader: tpl.leader,
      strength: tpl.strength,
      tier: tpl.tier,
      silver: tpl.silver,
      grain: tpl.grain,
      infamy: 25 + tpl.tier * 15,
      createdDay: day,
    };
    existingNames.add(tpl.name);
  }
  return Object.values(world.bandits);
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

