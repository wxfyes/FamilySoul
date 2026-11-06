/**
 * 城市基底：一座城要先有"能活的地方"，人去了才不是流放。
 *
 * 规矩：
 *   ① 只造地方与住户，不定剧情、不给身份剧本；
 *   ② 铺面数量、住户多少按城市等级与富庶度推；
 *   ③ 幂等：已生成的城不再重复造。
 */

import { ensureResidence } from './residence.js';
import { fallbackName } from './migration.js';

const slugOf = (city) => String(city || '').replace(/府$|县$|州$/g, '').trim();

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function ensurePlace(world, id, name, extra = {}) {
  if (world.places?.[id]) return world.places[id];
  world.places[id] = { id, name, exits: ['street'], dynamic: true, ...extra };
  return world.places[id];
}

function link(a, b) {
  const pa = worldPlaces(a);
  const pb = worldPlaces(b);
  if (!pa || !pb) return;
  pa.exits = Array.isArray(pa.exits) ? pa.exits : [];
  pb.exits = Array.isArray(pb.exits) ? pb.exits : [];
  if (!pa.exits.includes(pb.id)) pa.exits.push(pb.id);
  if (!pb.exits.includes(pa.id)) pb.exits.push(pa.id);
}

// 小工具：把 id 变成 place
let __world = null;
function worldPlaces(id) {
  return __world?.places?.[id] || null;
}

/**
 * 给一座城铺基底
 * @returns {{ok:boolean, places:number, people:number, city:string, reason?:string}}
 */
export function ensureCityBase(world, cityName) {
  const city = String(cityName || '').trim();
  if (!city || !world?.cities?.[city]) return { ok: false, reason: '没有这座城', places: 0, people: 0, city };
  world.flags = world.flags || {};
  world.flags.cityBase = world.flags.cityBase || {};
  if (world.flags.cityBase[city]) return { ok: true, places: 0, people: 0, city, cached: true };

  __world = world;
  const slug = slugOf(city);
  const ct = world.cities[city] || {};
  const rich = num(ct.wealth) || 30;
  const tier = rich >= 60 ? 3 : (rich >= 35 ? 2 : 1);   // 富庶度决定铺面多少

  // ── 地方 ──
  // 临江府的老地方就是 street，别再造一条"临江府·主街"
  const streetId = city === '临江府' && world.places?.street ? 'street' : `${slug}_street`;
  const marketId = `${slug}_market`;
  const innId = `${slug}_inn`;
  const riceId = `${slug}_rice`;
  const herbId = `${slug}_herb`;
  const teaId = `${slug}_tea`;
  ensurePlace(world, streetId, `${city}·主街`);
  ensurePlace(world, marketId, `${city}·集市`, { use: 'shop' });
  ensurePlace(world, innId, `${city}·客栈`, { use: 'shop' });
  ensurePlace(world, riceId, `${city}·米行`, { use: 'shop' });
  if (tier >= 2) ensurePlace(world, herbId, `${city}·药铺`, { use: 'shop' });
  if (tier >= 3) ensurePlace(world, teaId, `${city}·茶摊`, { use: 'shop' });

  // 衙署：已有就接上，没有就造一处
  let yamenId = Object.keys(world.places || {}).find((id) => {
    const n = String(world.places[id]?.name || '');
    return n.includes(city) && /衙/.test(n);
  });
  if (!yamenId) {
    yamenId = `${slug}_yamen`;
    ensurePlace(world, yamenId, `${city}·府衙`, { use: 'court' });
  }

  // 门路：街连所有
  const street = world.places[streetId];
  street.exits = [marketId, innId, riceId, yamenId];
  if (tier >= 2) street.exits.push(herbId);
  if (tier >= 3) street.exits.push(teaId);
  for (const id of street.exits) {
    const p = world.places[id];
    if (p) p.exits = Array.from(new Set([...(p.exits || []), streetId]));
  }
  // 集市本身再连铺面（让人能"进铺子"）
  const market = world.places[marketId];
  market.rooms = market.rooms || {};
  const shops = [riceId, ...(tier >= 2 ? [herbId] : []), ...(tier >= 3 ? [teaId] : [])];
  for (const sid of shops) {
    const sp = world.places[sid];
    if (sp) sp.exits = Array.from(new Set([...(sp.exits || []), marketId]));
    if (!market.exits.includes(sid)) market.exits.push(sid);
  }

  // ── 住户：按城等级 5~9 户 ──
  const want = 5 + tier * 2;
  let people = 0;
  const used = () => new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
  const roles = ['摊贩', '伙计', '掌柜', '更夫', '绣娘', '货郎', '跑堂', '厨娘', '脚夫'];
  for (let i = 0; i < want; i += 1) {
    const name = fallbackName(world, i % 3 === 2 ? 'female' : 'male');
    if (!name) break;
    const hid = `${slug}_house_${i + 1}`;
    if (!world.places[hid]) {
      world.places[hid] = {
        id: hid, name: `${name}家`, exits: [streetId], owner: null,
        residence: true, dynamic: true, createdDay: num(world.clock?.day) || 1,
      };
      ensureResidence(world, hid, { grade: 1 });
    }
    const role = roles[(i + tier) % roles.length];
    const aid = `${slug}_local_${i + 1}`;
    if (world.actors[aid]) continue;
    world.actors[aid] = {
      id: aid,
      name,
      role,
      title: role,
      gender: i % 3 === 2 ? 'female' : 'male',
      age: 20 + ((i * 7) % 35),
      home: hid,
      location: role === '摊贩' ? marketId : (role === '掌柜' ? riceId : streetId),
      money: Math.round((0.5 + Math.random() * 2) * 100) / 100,
      relations: {},
      origin: 'city_base',
      createdDay: num(world.clock?.day) || 1,
    };
    if (role === '摊贩') {
      world.actors[aid].stall = { good: '菜', word: '青菜', price: 0.04, sinceDay: num(world.clock?.day) || 1 };
    }
    people += 1;
  }

  world.flags.cityBase[city] = { at: Date.now(), streetId, marketId, innId, tier, people };
  console.log(`[City] ${city} 基底生成：街道/集市/客栈/米行 + ${people} 户人家`);
  __world = null;
  return { ok: true, places: street.exits.length, people, city, tier };
}

/** 全部城都铺一遍（已铺的跳过） */
export function ensureAllCityBases(world) {
  let n = 0;
  const cities = Object.entries(world.cities || {})
    .sort((a, b) => (Number(b[1]?.wealth) || 0) - (Number(a[1]?.wealth) || 0))
    .map(([k]) => k);
  const keep = new Set(['临江府', ...cities.slice(0, 12)]);
  for (const city of Object.keys(world.cities || {})) {
    if (!keep.has(city)) continue;
    try {
      const r = ensureCityBase(world, city);
      if (r.ok && !r.cached) n += 1;
    } catch { /* 忽略 */ }
  }
  return n;
}

/** 这座城的街在哪（没有就 null） */
export function streetOfCity(world, cityName) {
  const b = world?.flags?.cityBase?.[String(cityName || '').trim()];
  return b?.streetId && world.places?.[b.streetId] ? b.streetId : null;
}


/** 这处地方属于哪座城（按名字前缀认；老临江地点没有前缀，算临江府） */
export function cityOfPlace(world, placeId) {
  const name = String(world?.places?.[placeId]?.name || '');
  const cities = Object.keys(world?.cities || {}).sort((a, b) => b.length - a.length);
  for (const c of cities) {
    const base = c.replace(/府$|县$|州$/g, '');
    if (name.startsWith(`${c}·`) || name.startsWith(`${base}·`) || name.startsWith(c)) return c;
  }
  if (/临江/.test(name)) return '临江府';
  return '';
}
