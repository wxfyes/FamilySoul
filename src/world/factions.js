/**
 * 势力：谁手里有兵、有粮、有城。
 *
 * 世界不止一个主人。朝廷是势力，王家是势力，将来天道推演出来的枭雄也是势力。
 * 这里只放"数据与读数"，不做决策；决策在 strategy.js，执行在 warfare.js。
 *
 * 钱的出处不重复记账：
 *   朝廷 → world.court.treasury.silver（国库两）
 *   其他人 → world.assets.silver / 产业结算
 * 势力上的 troops / grain 才是势力自己的兵与粮。
 */

export const FACTION_KINDS = ['court', 'player', 'warlord', 'clan'];

export function ensureFactions(world) {
  world.factions = world.factions && typeof world.factions === 'object' ? world.factions : {};

  if (!world.factions.court) {
    world.factions.court = {
      id: 'court',
      name: '朝廷',
      kind: 'court',
      leader: 'court',
      cities: [],
      troops: 0,
      grain: 0,
      morale: 55,
      ambition: 40,
      stance: 'status_quo',
      createdDay: 1,
    };
  }

  if (!world.factions.wangjia) {
    world.factions.wangjia = {
      id: 'wangjia',
      name: '临江王家',
      kind: 'player',
      leader: 'husband',
      cities: [],
      troops: 0,
      grain: 0,
      morale: 60,
      ambition: 35,
      stance: 'defend',
      createdDay: 1,
    };
  }

  // 王家的兵沿用世界既有的 military（护院/乡勇/营兵）
  try {
    const mil = world.military || {};
    const wang = world.factions.wangjia;
    const worldTroops = (Number(mil.guards) || 0) + (Number(mil.militia) || 0) + (Number(mil.army) || 0);
    if (worldTroops > 0 && !(Number(wang.troops) > 0)) wang.troops = worldTroops;
    if (num(wang.morale) <= 0) wang.morale = Number(mil.morale) || 55;
    if (!(Number(wang.grain) > 0)) wang.grain = Number(mil.supplies) || 0;
  } catch { /* 忽略 */ }

  // 既有的势力（临江府衙/朝廷权贵/运河漕帮…）补上兵权字段，别另起一套
  for (const [fid, f] of Object.entries(world.factions)) {
    if (!f || typeof f !== 'object') continue;
    f.id = f.id || fid;
    if (!f.kind) f.kind = fid === 'court' ? 'court' : fid === 'wangjia' ? 'player' : 'clan';
    if (!f.leader) f.leader = fid === 'court' ? 'court' : fid === 'wangjia' ? 'husband' : null;
    if (f.troops === undefined) f.troops = 0;
    if (f.grain === undefined) f.grain = 0;
    if (f.morale === undefined) f.morale = Math.max(20, Math.min(80, Number(f.power) || 50));
    if (f.ambition === undefined) f.ambition = fid === 'court' ? 40 : fid === 'wangjia' ? 35 : 30;
    if (!f.stance) f.stance = fid === 'wangjia' ? 'defend' : 'status_quo';
    // 外交关系：谁跟谁亲（-100 死敌 ~ 100 盟友），默认 0
    f.relations = f.relations && typeof f.relations === 'object' ? f.relations : {};
    // 驻地表：兵必须站在某座城里（f.stationed = { 城名: 兵数 }）
    if (!f.stationed || typeof f.stationed !== 'object') {
      f.stationed = {};
      const own = Array.isArray(f.cities) && f.cities.length ? f.cities[0] : (fid === 'wangjia' ? '临江府' : null);
      const n = Number(f.troops) || 0;
      if (own && n > 0) f.stationed[own] = n;
    }
  }

  // 城的归属同步到势力：owner 是势力 id 就记在它名下
  for (const f of Object.values(world.factions)) {
    if (!Array.isArray(f.cities)) f.cities = [];
  }
  for (const [cityName, ct] of Object.entries(world.cities || {})) {
    if (!ct) continue;
    const owner = String(ct.owner || 'court');
    const f = world.factions[owner];
    if (f && !f.cities.includes(cityName)) f.cities.push(cityName);
  }

  return world.factions;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function factionOf(world, fid) {
  return world.factions?.[fid] || null;
}

/** 势力手头能动的现银（朝廷看国库，其余看家底） */
export function factionSilver(world, f) {
  if (!f) return 0;
  if (f.kind === 'court') return num(world.court?.treasury?.silver);
  if (f.id === 'wangjia') return num(world.assets?.silver);
  return num(f.silver);
}

/** 花势力的钱：够了才花，返回是否成功 */
export function spendFactionSilver(world, f, amount) {
  const need = num(amount);
  if (need <= 0) return true;
  const have = factionSilver(world, f);
  if (have < need) return false;
  if (f.kind === 'court') {
    world.court.treasury.silver = Math.round((num(world.court.treasury.silver) - need) * 100) / 100;
  } else if (f.id === 'wangjia') {
    world.assets.silver = Math.round((num(world.assets.silver) - need) * 100) / 100;
  } else {
    f.silver = Math.round((num(f.silver) - need) * 100) / 100;
  }
  return true;
}

/** 战力：兵数 × 士气 × 训练（士气 50 为基准，100 可翻倍） */
export function factionStrength(world, f) {
  if (!f) return 0;
  const troops = num(f.troops);
  if (troops <= 0) return 0;
  const morale = Math.max(10, Math.min(120, num(f.morale) || 50));
  const quality = f.id === 'wangjia' ? Math.max(20, num(world.military?.quality) || 50) : 50;
  // 新兵只算四成战力
  const fresh = Math.min(num(f.fresh), troops);
  const effective = (troops - fresh) + fresh * 0.4;
  // 装备系数（兵甲马）
  const g = f.gear || {};
  const wpn = Math.min(num(g.weapon), troops) / Math.max(1, troops);
  const arm = Math.min(num(g.armor), troops) / Math.max(1, troops);
  const horse = Math.min(num(g.horse), troops) / Math.max(1, troops);
  const gear = 0.7 + wpn * 0.3 + arm * 0.25 + horse * 0.35;
  return Math.round(effective * (0.6 + morale / 100) * (quality / 50) * gear);
}

/** 把王家势力回写进 world.military（兼容旧显示） */
export function syncWangjiaToMilitary(world) {
  const f = world.factions?.wangjia;
  if (!f) return;
  world.military = world.military || {};
  world.military.army = num(f.troops);
  world.military.morale = Math.round(num(f.morale) || 50);
  world.military.supplies = Math.round(num(f.grain) || 0);
}
