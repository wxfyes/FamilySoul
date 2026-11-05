/**
 * 地理与路：兵不能瞬移。
 *
 * 数据来自 world.geo.regions（每道有哪些城）。规则只有三条：
 *   ① 同道诸城相通（陆路一日可达）
 *   ② 相邻两道之间，必须经过"关隘城"（fortress）
 *   ③ 借道别人的城，要看守方肯不肯（relation 够高才放行）
 *
 * 这里只回答"能不能到、要几天、卡在哪"，不做决策。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 城 → 所属道 */
export function regionOf(world, cityName) {
  const ct = world.cities?.[cityName];
  return String(ct?.region || '');
}

/** 同道诸城（含自己） */
export function citiesInRegion(world, region) {
  return Object.entries(world.cities || {})
    .filter(([, ct]) => ct && String(ct.region || '') === region)
    .map(([name]) => name);
}

/**
 * 各道真实接壤表（古代驿道/山河阻隔的近似）。
 * 双向自动补齐：A 写 B，B 也自动算作邻 A。
 */
export const REGION_ADJACENCY = {
  江南道: ['淮南道', '淮北道', '闽浙道', '江西道', '荆湖道'],
  京畿道: ['河南道', '河北道', '山东道', '淮南道', '关内道'],
  淮南道: ['江南道', '淮北道', '河南道', '京畿道'],
  河北道: ['京畿道', '山东道', '河东道', '辽东道', '关内道'],
  岭南道: ['闽浙道', '江西道', '荆湖道', '云贵道'],
  剑南道: ['陇右道', '云贵道', '荆湖道', '关内道'],
  山东道: ['京畿道', '河北道', '河南道', '淮北道', '辽东道'],
  河东道: ['河北道', '关内道', '河南道', '京畿道'],
  关内道: ['京畿道', '河北道', '河东道', '陇右道', '剑南道'],
  荆湖道: ['江南道', '江西道', '河南道', '剑南道', '云贵道', '岭南道'],
  河南道: ['京畿道', '山东道', '淮南道', '淮北道', '荆湖道', '河东道'],
  辽东道: ['河北道', '山东道'],
  陇右道: ['关内道', '剑南道'],
  云贵道: ['剑南道', '荆湖道', '岭南道'],
  闽浙道: ['江南道', '江西道', '岭南道'],
  江西道: ['江南道', '闽浙道', '荆湖道', '岭南道'],
  淮北道: ['淮南道', '河南道', '山东道', '江南道'],
};

/** 相邻的道：查表，并且双向承认 */
export function neighborRegions(world, region) {
  const name = String(region || '');
  if (!name) return [];
  const out = new Set(REGION_ADJACENCY[name] || []);
  for (const [r, list] of Object.entries(REGION_ADJACENCY)) {
    if (list.includes(name)) out.add(r);
  }
  return [...out];
}

/** 某道的关隘城（defense 最高的那座） */
export function gatewayOf(world, region) {
  const cities = citiesInRegion(world, region);
  if (!cities.length) return null;
  return cities.sort((a, b) => num(world.cities[b]?.defense) - num(world.cities[a]?.defense))[0];
}

/**
 * 能不能从 fromCity 走到 toCity
 * @returns {{ok:boolean, days:number, reason?:string, via?:string[]}}
 */
export function canReach(world, fromCity, toCity, ownerFid) {
  if (!world.cities?.[fromCity]) return { ok: false, days: 0, reason: '出发地不存在' };
  if (!world.cities?.[toCity]) return { ok: false, days: 0, reason: '目的地不存在' };
  if (fromCity === toCity) return { ok: false, days: 0, reason: '就在这里' };

  const r1 = regionOf(world, fromCity);
  const r2 = regionOf(world, toCity);

  // 同道：一天就到
  if (r1 && r1 === r2) return { ok: true, days: 1, via: [fromCity, toCity] };

  // 不同道：必须经过两道的关隘
  const neighbors = neighborRegions(world, r1);
  if (!neighbors.includes(r2)) {
    return { ok: false, days: 0, reason: `「${r1}」与「${r2}」之间隔着别的道，路不通` };
  }

  const gwTarget = gatewayOf(world, r2);
  const gwSelf = gatewayOf(world, r1);
  const gate = gwTarget || gwSelf;
  if (!gate) return { ok: false, days: 0, reason: '找不到关隘' };

  const gateOwner = String(world.cities[gate]?.owner || 'court');
  if (ownerFid && gateOwner !== ownerFid) {
    const rel = num(world.factions?.[gateOwner]?.relations?.[ownerFid]);
    if (rel < 40) {
      return { ok: false, days: 0, reason: `「${gate}」由${world.factions?.[gateOwner]?.name || gateOwner}把守，不放你过` };
    }
  }

  return { ok: true, days: 3, via: [fromCity, gate, toCity], viaGate: gate };
}
