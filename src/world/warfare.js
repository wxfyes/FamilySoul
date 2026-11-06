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
import { marchSpeedFactor, gearCostFactor } from './season.js';
import { grainPrice } from './prices.js';
import { ensureGatekeeper } from './posts.js';
import { fallbackName } from './migration.js';
import { priceOf } from './pricing.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;

export const MONTHLY_PAY = 1.0;    // 每兵每月饷银（一两/月）
export const RECRUIT_COST = 0.2;   // 安家银（意思一下，真正的担子是月饷）
export const RECRUIT_GRAIN = 0.2;   // 随身粮
export const PAY_PER_DAY = 0;   // 已废：饷按月放，不走每日结算
export const GRAIN_PER_DAY = 0.03;   // 月粮约一石
export const GRAIN_PRICE = 0.6;

/** 军械作价（两） */
export const GEAR_PRICES = { weapon: priceOf('weapon'), armor: priceOf('armor'), horse: priceOf('horse'), siege: priceOf('siege') };
export const GEAR_NAMES = { weapon: '兵器', armor: '铠甲', horse: '战马', siege: '攻城器械' };
/** 新兵成军天数 */
export const TRAIN_DAYS = 7;

// 三种人：家丁（看家最便宜）、护院（精壮）、营兵（要地盘）
export const RECRUIT_KINDS = {
  // 月饷参考：明万历山东土兵 0.9 两、南兵 1.5 两；清绿营守兵 1 两、步兵 1.5 两
  guard: { name: '家丁', cost: 0.2, grain: 0.2, morale: 0, pay: 0.6, note: '看家护院' },
  retainer: { name: '护院', cost: 0.5, grain: 0.3, morale: 1, pay: 0.9, note: '精壮护院' },
  army: { name: '营兵', cost: 0.8, grain: 0.4, morale: 2, pay: 1.5, note: '能出征的营兵' },
};

/**
 * 一呼百应：不是花钱买人，是看你的名声与这座城的日子。
 * 名声越高、民心越稳，来投的人越多；荒年乱世反而有人来吃粮。
 */
export function callToArms(world, fid, { city, max = 60, kind = 'guard' } = {}) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const town = city && world.cities?.[city] ? city : factionCapital(world, f);
  const ct = world.cities?.[town];
  if (!ct) return { ok: false, error: '没有这座城' };

  const fame = Number(world.actors?.[f.leader]?.fame?.value) || 0;
  const unrest = Number(ct.unrest) || 0;
  const wealth = Number(ct.wealth) || 30;
  const base = 3 + fame / 6 + (50 - unrest) / 4 + wealth / 20;
  const luck = 0.6 + Math.random() * 0.8;
  let come = Math.round(base * luck);
  come = Math.max(1, Math.min(Math.max(1, max), come));

  const k = RECRUIT_KINDS[kind] || RECRUIT_KINDS.guard;

  // 私蓄甲士等同谋逆：营兵须据城或受朝命
  if (kind === 'army') {
    const hasCity = Array.isArray(f.cities) && f.cities.length > 0;
    const hasOffice = Boolean(world.court?.offices && Object.values(world.court.offices).some((o) => o && o.holder === f.leader));
    if (!hasCity && !hasOffice) {
      return { ok: false, error: '未奉朝命、未据城池，擅募野战营兵形同聚众谋逆！眼下只可招家丁与护院。' };
    }
  }

  const cost = round2(come * k.cost);
  const grain = round2(come * k.grain);
  if (num(f.grain) < grain) return { ok: false, error: `粮不够：${come} 人要 ${grain} 石（府库只剩 ${round2(f.grain)} 石，先去购粮）` };
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `安家银不够：要 ${cost} 两` };

  f.grain = round2(num(f.grain) - grain);
  setStationed(world, f, town, troopsAt(world, f, town) + come);
  f.kinds = f.kinds && typeof f.kinds === 'object' ? f.kinds : {};
  f.kinds[kind] = Math.round(num(f.kinds[kind]) + come);
  f.fresh = Math.round(num(f.fresh) + come);
  f.freshUntilDay = (Number(world.clock?.day) || 1) + TRAIN_DAYS;

  // 招进来的人要落地成人：每一个护院/家丁都真的住进府里，不是账上一个数字
  try {
    if (f.id === 'wangjia' && (kind === 'guard' || kind === 'retainer')) {
      const made = spawnHouseholdStaff(world, come, kind);
      if (made) {
        ensureGatekeeper(world, 'husband_room');
        console.log(`[Staff] 新募 ${made} 人落籍入府`);
      }
    }
  } catch (err) { console.log('[Staff] 落籍失败：', err.message); }

  fire(world, { action: 'recruit', actor: f.leader, place: town, payload: { text: `${f.name}在${town}一呼百应，来投 ${come} 人` } });
  return { ok: true, came: come, asked: max, troops: totalTroops(world, f), city: town, cost, monthlyPay: round2(totalTroops(world, f) * MONTHLY_PAY) };
}

/** 把招募来的人真的立进世界（家丁/护院），返回立了几人 */
export function spawnHouseholdStaff(world, count, kind = 'guard', homeId = 'husband_room') {
  const home = world.places?.[homeId];
  if (!home) return 0;
  const want = Math.max(0, Math.min(24, Number(count) || 0));
  let made = 0;
  for (let i = 0; i < want; i++) {
    // 用世界统一的姓名池（和城里其他人一个来源），不再自己拍脑袋起名
    let name = fallbackName(world, 'male') || '';
    if (!name) {
      const used = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
      const SURNAME = ['周', '吴', '郑', '王', '李', '陈', '张', '刘', '赵', '孙'];
      const GIVEN = ['阿福', '阿顺', '阿贵', '阿全', '阿安', '阿平', '阿庆', '阿寿', '阿泰', '阿和'];
      for (let t = 0; t < 30; t++) {
        const cand = SURNAME[Math.floor(Math.random() * SURNAME.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)];
        if (!used.has(cand)) { name = cand; break; }
      }
    }
    if (!name) continue;
    const id = `staff_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`;
    world.actors[id] = {
      id, name,
      role: kind === 'guard' ? '家丁' : '护院',
      title: kind === 'guard' ? '家丁' : '护院',
      age: 20 + Math.floor(Math.random() * 15),
      home: homeId,
      quarters: home.rooms?.barracks?.id || home.rooms?.servant?.id || null,
      location: home.rooms?.barracks?.id || home.rooms?.gate?.id || homeId,
      servant: true,
      duty: { post: 'guard', home: homeId },
      relations: { husband: { trust: 45, desire: 0 } },
    };
    made += 1;
  }
  return made;
}

/** 这个势力每月该发多少饷（按兵种构成算） */
export function monthlyPayOf(f) {
  if (!f) return 0;
  const kinds = f.kinds && typeof f.kinds === 'object' ? f.kinds : null;
  const total = Object.values(f.stationed || {}).reduce((x, y) => x + (Number(y) || 0), 0) || Number(f.troops) || 0;
  if (!kinds) return Math.round(total * MONTHLY_PAY * 100) / 100;
  let sum = 0;
  let counted = 0;
  for (const [k, n] of Object.entries(kinds)) {
    const rate = (RECRUIT_KINDS[k]?.pay) ?? MONTHLY_PAY;
    sum += (Number(n) || 0) * rate;
    counted += Number(n) || 0;
  }
  // 兵种账与实际兵力对不上时，多出来的按 1 两补
  if (total > counted) sum += (total - counted) * MONTHLY_PAY;
  return Math.round(sum * 100) / 100;
}

/**
 * 放饷日：每月初一（day % 30 === 0）
 * 银够 → 足额放饷，士气振；银不够 → 欠饷，记录月数与欠额
 * 欠饷 1 月：怨声四起（士气 -15）
 * 欠饷 2 月：开小差（逃 10%，折损军械）
 * 欠饷 3 月以上：哗变（逃 25%，可能会反噬）
 */
export function runPayday(world, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return [];
  const out = [];

  for (const f of Object.values(world.factions || {})) {
    if (!f) continue;
    const troops = totalTroops(world, f);
    if (troops <= 0) continue;

    const due = round2(monthlyPayOf(f));
    f.arrears = f.arrears && typeof f.arrears === 'object' ? f.arrears : { months: 0, owed: 0 };

    if (spendFactionSilver(world, f, due)) {
      f.morale = Math.min(100, Math.round(num(f.morale) + 6));
      if (f.arrears.months > 0) {
        out.push({ action: 'pay_arrears_clear', actor: f.leader, place: null, payload: { text: `${f.name}补清积欠，营中欢声雷动` } });
      } else {
        out.push({ action: 'payday', actor: f.leader, place: null, payload: { text: `${f.name}放饷 ${due} 两，军心大定` } });
      }
      f.arrears = { months: 0, owed: 0 };
      continue;
    }

    // 欠饷
    f.arrears.months += 1;
    f.arrears.owed = round2(num(f.arrears.owed) + due);
    f.morale = Math.max(0, Math.round(num(f.morale) - 15));
    out.push({ action: 'arrears', actor: f.leader, place: null, payload: { text: `${f.name}欠饷 ${f.arrears.months} 月（欠 ${f.arrears.owed} 两），营中怨声四起` } });

    if (f.arrears.months >= 2) {
      const town = Object.keys(f.stationed || {})[0];
      if (town) {
        const flee = Math.max(1, Math.round(num(f.stationed[town]) * 0.1));
        setStationed(world, f, town, Math.max(0, troopsAt(world, f, town) - flee));
        f.gear = f.gear || {};
        if (Number(f.gear.weapon) > 0) f.gear.weapon = Math.max(0, Math.round(f.gear.weapon - flee));
        out.push({ action: 'desert', actor: f.leader, place: town, payload: { text: `${f.name}欠饷日久，逃兵 ${flee} 人，典当了部分兵甲` } });
      }
    }
    if (f.arrears.months >= 3) {
      const town = Object.keys(f.stationed || {})[0];
      if (town) {
        const flee = Math.max(1, Math.round(num(f.stationed[town]) * 0.25));
        setStationed(world, f, town, Math.max(0, troopsAt(world, f, town) - flee));
        f.morale = 20;
        let lootText = '';
        // 溃兵啸聚：三成概率洗劫军粮与府库
        if (Math.random() < 0.3) {
          try {
            const ct = world.cities?.[town];
            if (ct && num(ct.grain) > 0) {
              const takeGrain = Math.min(num(ct.grain), 50);
              ct.grain = round2(num(ct.grain) - takeGrain);
              lootText += `劫走军粮 ${takeGrain} 石；`;
            }
            const lootSilver = Math.min(num(world.assets?.silver), 50);
            if (lootSilver > 0) {
              world.assets.silver = round2(num(world.assets.silver) - lootSilver);
              lootText += `掠去府库 ${lootSilver} 两；`;
            }
          } catch { /* 忽略 */ }
        }
        out.push({ action: 'mutiny', actor: f.leader, place: town, payload: { text: `${f.name}欠饷三月，营中哗变，溃散 ${flee} 人${lootText ? `，${lootText}` : ''}` } });
        try {
          if (world.cities?.[town]) world.cities[town].unrest = Math.min(100, num(world.cities[town].unrest) + 10);
        } catch { /* 忽略 */ }
      }
    }
  }
  return out;
}

/** 补发积欠军饷：有钱就能补，补完士气回血 */
export function payArrears(world, fid) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const ar = f.arrears || { months: 0, owed: 0 };
  if (!(Number(ar.owed) > 0)) return { ok: false, error: '并不欠饷' };
  if (!spendFactionSilver(world, f, Number(ar.owed))) {
    return { ok: false, error: `银不够：欠 ${ar.owed} 两，手头 ${round2(factionSilver(world, f))} 两` };
  }
  f.arrears = { months: 0, owed: 0 };
  f.morale = Math.min(100, Math.round(num(f.morale) + 20));
  return { ok: true, paid: round2(Number(ar.owed)), morale: f.morale };
}

/** 每月饷银与口粮（给面板显示） */
export function upkeepOf(world, f) {
  const troops = totalTroops(world, f);
  return { troops, monthlyPay: monthlyPayOf(f), monthlyGrain: round2(troops * GRAIN_PER_DAY * 30) };
}

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
  const ironFactor = ['weapon', 'armor', 'siege'].includes(k) ? gearCostFactor(world) : 1;
  const cost = round2(n * price * ironFactor);
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
export function recruit(world, fid, count, city, kind = 'guard') {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const n = Math.max(1, Math.min(500, Math.round(num(count))));
  const town = city && world.cities?.[city] ? city : factionCapital(world, f);
  if (!world.cities?.[town]) return { ok: false, error: '落脚城不存在' };

  const k = RECRUIT_KINDS[kind] || RECRUIT_KINDS.guard;
  const cost = round2(n * k.cost);
  const needGrain = round2(n * k.grain);
  if (num(f.grain) < needGrain) return { ok: false, error: `粮不够：募 ${n} 兵要 ${needGrain} 石，手头 ${round2(f.grain)} 石` };
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：募 ${n} 兵要 ${cost} 两，手头 ${round2(factionSilver(world, f))} 两` };

  f.grain = round2(num(f.grain) - needGrain);
  setStationed(world, f, town, troopsAt(world, f, town) + n);
  // 新募之兵要练：七天之内战力只有四成
  f.kinds = f.kinds && typeof f.kinds === 'object' ? f.kinds : {};
  f.kinds[kind] = Math.round(num(f.kinds[kind]) + n);
  f.fresh = Math.round(num(f.fresh) + n);
  f.freshUntilDay = (Number(world.clock?.day) || 1) + TRAIN_DAYS;
  f.morale = Math.min(100, Math.round(num(f.morale) + 1 + k.morale));
  fire(world, { action: 'recruit', actor: f.leader, place: town, payload: { text: `${f.name}在${town}募${k.name} ${n} 人` } });
  return { ok: true, troops: totalTroops(world, f), stationed: troopsAt(world, f, town), city: town, cost };
}

/** 买粮：存进指定城的仓（没有城就存随军） */
export function buyGrain(world, fid, shi, city) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const amount = Math.max(1, Math.min(2000, Math.round(num(shi))));
  const unitPrice = grainPrice(world, city || factionCapital(world, f));
  const cost = round2(amount * unitPrice);
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：买 ${amount} 石要 ${cost} 两` };

  // 粮进府库（招兵、放粮看的都是这一个数）；城里另记一份徭赈库存，供赈济与守城用
  f.grain = round2(num(f.grain) + amount);
  const town = city && world.cities?.[city] ? city : (Array.isArray(f.cities) && f.cities[0]) || '';
  if (town && world.cities?.[town]) {
    world.cities[town].grain = round2(num(world.cities[town].grain) + Math.round(amount * 0.3 * 100) / 100);
  }
  if (f.id === 'wangjia') syncWangjiaToMilitary(world);
  return { ok: true, grain: f.grain, city: town, cost, unitPrice };
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

    // 日常只吃粮，不发饷（放饷是每月一次的事）
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

    // 粮够 → 士气稳；粮不够 → 掉士气（饷另算，见放饷日）
    if (fed) f.morale = Math.min(100, Math.round(num(f.morale) + 1));
    else {
      f.morale = Math.max(0, Math.round(num(f.morale) - 4));
      fire(world, { action: 'army_hungry', actor: f.leader, place: null, payload: { text: `${f.name}军中缺粮，士气跌落` } });
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
  const daysReal = Math.max(1, Math.ceil(road.days * marchSpeedFactor(world)));
  const arriveDay = (Number(world.clock?.day) || 1) + daysReal;
  f.marches.push({ from: fromCity, to: toCity, troops: send, arriveDay, viaGate: road.viaGate || null });
  fire(world, { action: 'march_start', actor: f.leader, place: fromCity, payload: { text: `${f.name}${send}兵自${fromCity}开拔，${daysReal}日可至${toCity}` } });
  return { ok: true, days: daysReal, arriveDay, troops: send };
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
