/**
 * 兵权与夺城（v2）：兵有驻地，粮有仓，路要通，仗要打几天。
 *
 * 规则：
 *   · 兵只能驻在城里（f.stationed = { 城名: 兵数 }）
 *   · 募兵落在自己第一座城（没有城就落在临江府）
 *   · 出兵要先驻好兵，再行军，到了才围城
 *   · 军粮先吃所在城的仓，仓空了吃随军粮（f.grain）
 *   · 城的归属只在这里改
 */

import { factionOf, factionSilver, spendFactionSilver, factionStrength, syncWangjiaToMilitary } from './factions.js';
import { canReach } from './geography.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;

export const RECRUIT_COST = 12;
export const RECRUIT_GRAIN = 0.5;
export const PAY_PER_DAY = 0.05;
export const GRAIN_PER_DAY = 0.02;
export const GRAIN_PRICE = 0.6;

/** 军械作价（两） */
export const GEAR_PRICES = { weapon: 3, armor: 5, horse: 20, siege: 300 };
export const GEAR_NAMES = { weapon: '兵器', armor: '铠甲', horse: '战马', siege: '攻城器械' };
/** 新兵成军天数 */
export const TRAIN_DAYS = 7;

let eventSink = null;

/** 装备系数：兵甲齐备者更强（0.7 ~ 1.6） */
export function gearFactor(f) {
  const troops = Math.max(1, Number(f?.troops) || 0);
  const g = f?.gear || {};
  const wpn = Math.min(Number(g.weapon) || 0, troops) / troops;
  const arm = Math.min(Number(g.armor) || 0, troops) / troops;
  const horse = Math.min(Number(g.horse) || 0, troops) / troops;
  return 0.7 + wpn * 0.3 + arm * 0.25 + horse * 0.35;
}

/** 买军械 */
export function buyGear(world, fid, kind, qty) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const k = String(kind || '');
  const price = GEAR_PRICES[k];
  if (!price) return { ok: false, error: '没有这种军械' };
  const n = Math.max(1, Math.min(500, Math.round(num(qty))));
  const cost = round2(n * price);
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：${n} 件${GEAR_NAMES[k]}要 ${cost} 两` };
  f.gear = f.gear && typeof f.gear === 'object' ? f.gear : {};
  f.gear[k] = Math.round((Number(f.gear[k]) || 0) + n);
  return { ok: true, gear: f.gear, cost };
}
export function setWarEventSink(fn) {
  eventSink = fn;
}
function fire(world, ev) {
  try { eventSink?.(world, ev); } catch { /* 忽略 */ }
}

export function factionCapital(world, f) {
  if (!f) return '临江府';
  const own = Array.isArray(f.cities) ? f.cities.filter((c) => world.cities?.[c]) : [];
  if (own.length) return own[0];
  return '临江府';
}

/**
 * 城市易主：唯一写入口。
 * 旧主的领地账本必须原子化剔除，不许出现"三方同时声称拥有"。
 */
export function changeCityOwner(world, cityName, newOwnerFid) {
  const ct = world.cities?.[cityName];
  if (!ct) return false;
  const oldOwner = String(ct.owner || 'court');

  const old = world.factions?.[oldOwner];
  if (old && Array.isArray(old.cities)) old.cities = old.cities.filter((c) => c !== cityName);

  ct.owner = newOwnerFid;

  const next = world.factions?.[newOwnerFid];
  if (next) {
    next.cities = Array.isArray(next.cities) ? next.cities : [];
    if (!next.cities.includes(cityName)) next.cities.push(cityName);
  }
  // 城里若还驻着旧主的兵，随城一并转归新主（免得兵与城分离）
  if (old && old.stationed && old.stationed[cityName]) {
    const n = Number(old.stationed[cityName]) || 0;
    delete old.stationed[cityName];
    old.troops = Object.values(old.stationed).reduce((x, y) => x + (Number(y) || 0), 0);
    if (next) {
      next.stationed = next.stationed && typeof next.stationed === 'object' ? next.stationed : {};
      next.stationed[cityName] = (Number(next.stationed[cityName]) || 0) + n;
      next.troops = Object.values(next.stationed).reduce((x, y) => x + (Number(y) || 0), 0);
    }
  }
  return true;
}

/** 某城的驻军 */
export function troopsAt(world, f, city) {
  if (!f) return 0;
  return Math.round(num(f.stationed?.[city]));
}

/** 改驻军（唯一入口） */
function setStationed(world, f, city, value) {
  f.stationed = f.stationed && typeof f.stationed === 'object' ? f.stationed : {};
  const next = Math.max(0, Math.round(num(value)));
  if (next > 0) f.stationed[city] = next;
  else delete f.stationed[city];
  f.troops = Object.values(f.stationed).reduce((s, x) => s + num(x), 0);
  if (f.id === 'wangjia') syncWangjiaToMilitary(world);
}

/** 合计兵力 */
export function totalTroops(world, f) {
  if (!f) return 0;
  if (f.stationed && typeof f.stationed === 'object') {
    return Object.values(f.stationed).reduce((s, x) => s + num(x), 0);
  }
  return Math.round(num(f.troops));
}

/** 募兵：落在自己的城（默认首城） */
export function recruit(world, fid, count, city) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const n = Math.max(1, Math.min(500, Math.round(num(count))));
  const town = city && world.cities?.[city] ? city : factionCapital(world, f);
  if (!world.cities?.[town]) return { ok: false, error: '落脚城不存在' };

  const cost = round2(n * RECRUIT_COST);
  const needGrain = round2(n * RECRUIT_GRAIN);
  if (num(f.grain) < needGrain) return { ok: false, error: `粮不够：募 ${n} 兵要 ${needGrain} 石，手头 ${round2(f.grain)} 石` };
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：募 ${n} 兵要 ${cost} 两，手头 ${round2(factionSilver(world, f))} 两` };

  f.grain = round2(num(f.grain) - needGrain);
  setStationed(world, f, town, troopsAt(world, f, town) + n);
  // 新募之兵要练：七天之内战力只有四成
  f.fresh = Math.round(num(f.fresh) + n);
  f.freshUntilDay = (Number(world.clock?.day) || 1) + TRAIN_DAYS;
  f.morale = Math.min(100, Math.round(num(f.morale) + 1));
  fire(world, { action: 'recruit', actor: f.leader, place: town, payload: { text: `${f.name}在${town}募兵 ${n} 人` } });
  return { ok: true, troops: totalTroops(world, f), stationed: troopsAt(world, f, town), city: town, cost };
}

/** 买粮：存进指定城的仓（没有城就存随军） */
export function buyGrain(world, fid, shi, city) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const amount = Math.max(1, Math.min(2000, Math.round(num(shi))));
  const cost = round2(amount * GRAIN_PRICE);
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：买 ${amount} 石要 ${cost} 两` };

  const town = city && world.cities?.[city] ? city : (Array.isArray(f.cities) && f.cities[0]) || '';
  if (town && world.cities?.[town]) {
    world.cities[town].grain = round2(num(world.cities[town].grain) + amount);
    if (f.id === 'wangjia') syncWangjiaToMilitary(world);
    return { ok: true, grain: world.cities[town].grain, city: town, cost };
  }
  f.grain = round2(num(f.grain) + amount);
  if (f.id === 'wangjia') syncWangjiaToMilitary(world);
  return { ok: true, grain: f.grain, city: '', cost };
}

/** 产业粮转军粮：把自家粮栈产出的粮调进某城仓 */
export function transferPropertyGrain(world, fid, propId, city, shi) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
  const p = props.find((x) => x && String(x.id) === String(propId));
  if (!p) return { ok: false, error: '没有这处产业' };
  if (String(p.owner || '') !== fid && fid !== 'wangjia') return { ok: false, error: '不是你的产业' };
  const stock = num(p.grainStock);
  const take = Math.min(stock, Math.max(1, Math.round(num(shi))));
  if (take <= 0) return { ok: false, error: '这处产业暂无可调之粮' };
  const town = city && world.cities?.[city] ? city : ((Array.isArray(f.cities) && f.cities[0]) || '');
  if (!town || !world.cities?.[town]) return { ok: false, error: '要调往哪座城？你还没有城' };
  p.grainStock = round2(stock - take);
  world.cities[town].grain = round2(num(world.cities[town].grain) + take);
  return { ok: true, grain: world.cities[town].grain, city: town, moved: take };
}

/** 每日：军饷、吃粮（先吃城仓，再吃随军粮）、逃兵、行军抵达 */
export function runMilitaryDay(world, events) {
  for (const f of Object.values(world.factions || {})) {
    if (!f) continue;
    const total = totalTroops(world, f);
    if (total <= 0) continue;

    const pay = round2(total * PAY_PER_DAY);
    const grainNeed = round2(total * GRAIN_PER_DAY);

    // 吃粮：先吃驻地的仓
    let fedQty = 0;
    for (const [town, n] of Object.entries(f.stationed || {})) {
      const want = round2(num(n) * GRAIN_PER_DAY);
      const inCity = num(world.cities?.[town]?.grain);
      const take = Math.min(want, inCity);
      if (take > 0) {
        world.cities[town].grain = round2(inCity - take);
        fedQty = round2(fedQty + take);
      }
    }
    const rest = round2(grainNeed - fedQty);
    let fed = rest <= 0.001;
    if (!fed && num(f.grain) >= rest) {
      f.grain = round2(num(f.grain) - rest);
      fed = true;
    }

    let paid = spendFactionSilver(world, f, pay);

    if (paid && fed) f.morale = Math.min(100, Math.round(num(f.morale) + 1));
    else {
      f.morale = Math.max(0, Math.round(num(f.morale) - (paid ? 3 : 6)));
      if (!fed) fire(world, { action: 'army_hungry', actor: f.leader, place: null, payload: { text: `${f.name}军中缺粮，士气跌落` } });
      if (!paid) fire(world, { action: 'army_unpaid', actor: f.leader, place: null, payload: { text: `${f.name}欠饷，营中怨声四起` } });
    }

    if (num(f.morale) < 25 && Math.random() < 0.5) {
      const town = Object.keys(f.stationed || {})[0];
      if (town) {
        const flee = Math.max(1, Math.round(num(f.stationed[town]) * 0.1));
        setStationed(world, f, town, Math.max(0, troopsAt(world, f, town) - flee));
        f.morale = 30;
        fire(world, { action: 'desert', actor: f.leader, place: town, payload: { text: `${f.name}逃兵 ${flee} 人` } });
      }
    }
  }

  // 新兵成军
  for (const f of Object.values(world.factions || {})) {
    if (!f || !(Number(f.fresh) > 0)) continue;
    if ((Number(world.clock?.day) || 1) >= (Number(f.freshUntilDay) || 0)) {
      fire(world, { action: 'army_ready', actor: f.leader, place: null, payload: { text: `${f.name}新募 ${f.fresh} 兵已成军` } });
      f.fresh = 0;
      f.freshUntilDay = 0;
    }
  }

  // 行军抵达
  for (const f of Object.values(world.factions || {})) {
    if (!f || !Array.isArray(f.marches)) continue;
    const remain = [];
    for (const m of f.marches) {
      if ((Number(world.clock?.day) || 1) < num(m.arriveDay)) { remain.push(m); continue; }
      if (!world.cities?.[m.to]) continue;
      setStationed(world, f, m.to, troopsAt(world, f, m.to) + num(m.troops));
      fire(world, { action: 'march_arrive', actor: f.leader, place: m.to, payload: { text: `${f.name}兵抵${m.to}` } });
    }
    f.marches = remain;
  }
}

/** 行军：从驻地出发，路上要走几天 */
export function march(world, fid, fromCity, toCity, troops) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const have = troopsAt(world, f, fromCity);
  const send = Math.min(Math.round(num(troops)), have);
  if (send < 1) return { ok: false, error: `「${fromCity}」没有你的兵` };

  const road = canReach(world, fromCity, toCity, fid);
  if (!road.ok) return { ok: false, error: road.reason || '路不通' };

  // 军粮随行：按天数带足
  const needGrain = round2(send * GRAIN_PER_DAY * (road.days + 2));
  if (num(f.grain) < needGrain) return { ok: false, error: `随军粮不够：要走 ${road.days} 天，需 ${needGrain} 石` };

  f.grain = round2(num(f.grain) - needGrain);
  setStationed(world, f, fromCity, have - send);
  f.marches = Array.isArray(f.marches) ? f.marches : [];
  const arriveDay = (Number(world.clock?.day) || 1) + road.days;
  f.marches.push({ from: fromCity, to: toCity, troops: send, arriveDay, viaGate: road.viaGate || null });
  fire(world, { action: 'march_start', actor: f.leader, place: fromCity, payload: { text: `${f.name}${send}兵自${fromCity}开拔，${road.days}日可至${toCity}` } });
  return { ok: true, days: road.days, arriveDay, troops: send };
}

/** 围城：必须在该城有驻军（行军到了才算） */
export function besiege(world, { attacker, cityName, troops }) {
  const f = factionOf(world, attacker);
  if (!f) return { ok: false, error: '没有这个势力' };
  const ct = world.cities?.[cityName];
  if (!ct) return { ok: false, error: '没有这座城' };
  if (String(ct.owner || 'court') === attacker) return { ok: false, error: '这是你自己的城' };

  const here = troopsAt(world, f, cityName);
  if (here < 1) return { ok: false, error: `${cityName}没有你的兵，先派人过去` };
  const send = Math.min(Math.round(num(troops)), here);
  if (send < 1) return { ok: false, error: '兵力不足' };

  const defense = Math.round((num(ct.defense) || 10) + (num(ct.garrison) || 0) * 1.2);
  const siegeBonus = Math.min(60, Math.round((Number(f.gear?.siege) || 0) * 15));
  const attackPower = Math.round(factionStrength(world, f) * (send / Math.max(1, totalTroops(world, f))) + siegeBonus);
  const roll = 0.8 + Math.random() * 0.5;
  const win = attackPower * roll > defense;

  // 攻城是硬仗：胜方生还 45%~60%，败方全损
  const surviveRate = win ? 0.45 + Math.random() * 0.15 : 0;
  setStationed(world, f, cityName, here - send + Math.round(send * surviveRate));

  if (win) {
    changeCityOwner(world, cityName, attacker);
    ct.defense = Math.max(5, Math.round(defense * 0.6));
    ct.unrest = Math.min(100, (num(ct.unrest) || 0) + 10);
    f.morale = Math.min(100, Math.round(num(f.morale) + 5));
    fire(world, { action: 'city_taken', actor: f.leader, place: cityName, payload: { text: `${f.name}破${cityName}，城易主` } });
    return { ok: true, win: true, attackPower, defense, text: `${f.name}破${cityName}，城易主` };
  }

  ct.defense = Math.min(80, Math.round(defense * 0.85));
  f.morale = Math.max(0, Math.round(num(f.morale) - 8));
  fire(world, { action: 'siege_failed', actor: f.leader, place: cityName, payload: { text: `${f.name}攻${cityName}不下，折兵而退` } });
  return { ok: true, win: false, attackPower, defense, text: `${f.name}攻${cityName}不下，折兵而退` };
}

/** 招降 / 修城 */
export function bribeCity(world, fid, cityName, amount = 300) {
  const f = factionOf(world, fid);
  const ct = world.cities?.[cityName];
  if (!f || !ct) return { ok: false, error: '没有这个势力或这座城' };
  if (String(ct.owner || 'court') === fid) return { ok: false, error: '这是你自己的城' };
  const cost = Math.round(num(amount));
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：疏通要 ${cost} 两` };
  if (Math.random() < 0.45) {
    changeCityOwner(world, cityName, fid);
    ct.unrest = Math.min(100, (num(ct.unrest) || 0) + 4);
    fire(world, { action: 'city_taken', actor: f.leader, place: cityName, payload: { text: `${cityName}守将纳款开城，归${f.name}` } });
    return { ok: true, win: true, text: `${cityName}守将纳款开城，归${f.name}` };
  }
  ct.defense = Math.min(90, Math.round((num(ct.defense) || 10) + 3));
  return { ok: true, win: false, text: `${cityName}守将收了银子却不认账，城防更严` };
}

export function fortify(world, fid, cityName, amount = 200) {
  const f = factionOf(world, fid);
  const ct = world.cities?.[cityName];
  if (!f || !ct) return { ok: false, error: '没有这个势力或这座城' };
  if (String(ct.owner || 'court') !== fid) return { ok: false, error: '不是你的城' };
  const cost = Math.round(num(amount));
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：修城要 ${cost} 两` };
  ct.defense = Math.min(90, Math.round((num(ct.defense) || 10) + 6));
  return { ok: true, defense: ct.defense, cost };
}

/** 驻防：把兵从一个城调到另一个自己控制的城（同道即日到） */
export function stationTroops(world, fid, fromCity, toCity, troops) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const have = troopsAt(world, f, fromCity);
  const send = Math.min(Math.round(num(troops)), have);
  if (send < 1) return { ok: false, error: `${fromCity}没有兵` };
  if (String(world.cities?.[toCity]?.owner || 'court') !== fid) return { ok: false, error: `${toCity}不是你的城` };
  setStationed(world, f, fromCity, have - send);
  setStationed(world, f, toCity, troopsAt(world, f, toCity) + send);
  return { ok: true, from: fromCity, to: toCity, troops: send };
}
