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

/** 相邻的道：按 geo.regions 的顺序首尾相连（地理上相邻，简化但稳定） */
export function neighborRegions(world, region) {
  const list = (world.geo?.regions || []).map((r) => r.name);
  const i = list.indexOf(region);
  if (i < 0) return [];
  const out = [];
  if (i > 0) out.push(list[i - 1]);
  if (i < list.length - 1) out.push(list[i + 1]);
  return out;
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
