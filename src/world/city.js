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

  // ── 大户与官府：一城至少一个乡绅、一个衙役，外城才有"能主事的人" ──
  const notables = [
    { role: '乡绅', place: marketId, money: 60 },
    { role: '衙役', place: yamenId, money: 3 },
  ];
  for (const n of notables) {
    const nm = fallbackName(world, 'male');
    if (!nm) continue;
    const nid = `${slug}_notable_${n.role}`;
    if (world.actors[nid]) continue;
    const hid = `${slug}_house_${n.role}`;
    if (!world.places[hid]) {
      world.places[hid] = { id: hid, name: `${nm}宅`, exits: [streetId], residence: true, dynamic: true, createdDay: num(world.clock?.day) || 1 };
      ensureResidence(world, hid, { grade: n.role === '乡绅' ? 3 : 1 });
    }
    world.actors[nid] = {
      id: nid, name: nm, role: n.role, title: n.role, gender: 'male',
      age: 40 + Math.floor(Math.random() * 15),
      home: hid, location: n.place, money: n.money, relations: {},
      origin: 'city_base', createdDay: num(world.clock?.day) || 1,
    };
    people += 1;
  }

  // ── 本地差事：给外城一个能挣饭吃的入口 ──
  const jobs = [
    { title: '米行帮工', pay: 0.05, place: riceId },
    { title: '客栈跑堂', pay: 0.05, place: innId },
    { title: '更夫', pay: 0.04, place: streetId },
    { title: '码头卸货', pay: 0.06, place: streetId },
  ];

  // 商会：每城一个，会首由乡绅出任（行会里的事由他去张罗）
  try {
    world.guilds = world.guilds || {};
    if (!world.guilds[city]) {
      const chief = world.actors?.[`${slug}_notable_乡绅`];
      world.guilds[city] = {
        name: `${city}商会`, city,
        head: chief?.id || null, headName: chief?.name || '',
        dues: tier >= 3 ? 3 : 2, attitude: 'neutral',
      };
    }
  } catch { /* 忽略 */ }

  world.flags.cityBase[city] = { at: Date.now(), streetId, marketId, innId, tier, people, jobs };
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


/** 老城补配套：差事表 + 乡绅/衙役（幂等） */
export function ensureCityExtras(world, cityName) {
  const city = String(cityName || '');
  const b = world?.flags?.cityBase?.[city];
  if (!b) return 0;
  __world = world;
  let n = 0;
  if (!Array.isArray(b.jobs)) {
    b.jobs = [
      { title: '米行帮工', pay: 0.05, place: b.streetId },
      { title: '客栈跑堂', pay: 0.05, place: b.innId },
      { title: '更夫', pay: 0.04, place: b.streetId },
      { title: '码头卸货', pay: 0.06, place: b.streetId },
    ];
    n += 1;
  }
  const slug = city.replace(/府$|县$|州$/g, '');
  for (const role of ['乡绅', '衙役']) {
    const nid = `${slug}_notable_${role}`;
    if (world.actors?.[nid]) continue;
    const nm = fallbackName(world, 'male');
    if (!nm) continue;
    const hid = `${slug}_house_${role}`;
    if (!world.places[hid]) {
      world.places[hid] = { id: hid, name: `${nm}宅`, exits: [b.streetId], residence: true, dynamic: true };
      ensureResidence(world, hid, { grade: role === '乡绅' ? 3 : 1 });
    }
    world.actors[nid] = {
      id: nid, name: nm, role, title: role, gender: 'male',
      age: 42 + Math.floor(Math.random() * 12), home: hid,
      location: role === '衙役' ? (b.yamenId || b.streetId) : b.marketId,
      money: role === '乡绅' ? 60 : 3, relations: {}, origin: 'city_base',
    };
    n += 1;
  }
  __world = null;
  return n;
}


/**
 * 城里的阶级：大户人家、富商、公子、小姐各有其人。
 * 只造"人与住处"，不预设他们的恩怨情仇。
 */
export function ensureCityClasses(world, cityName) {
  const city = String(cityName || '');
  const b = world?.flags?.cityBase?.[city];
  if (!b) return 0;
  if (b.classesDone) return 0;
  __world = world;
  const slug = city.replace(/府$|县$|州$/g, '');
  const tier = Number(b.tier) || 1;
  const day = num(world.clock?.day) || 1;
  let made = 0;

  const addFamily = (idx) => {
    const surname = ['沈', '顾', '陆', '谢', '崔', '裴', '柳', '薛', '温', '苏'][Math.floor(Math.random() * 10)];
    const given = (g) => {
      const male = ['文远', '景行', '子昂', '怀瑾', '承泽', '彦之'];
      const female = ['婉宁', '清欢', '知微', '若兰', '云舒', '含章'];
      const pool = g === 'female' ? female : male;
      return surname + pool[Math.floor(Math.random() * pool.length)];
    };
    const hid = `${slug}_estate_${idx}`;
    if (!world.places[hid]) {
      world.places[hid] = {
        id: hid, name: `${surname}府`, exits: [b.streetId], residence: true, dynamic: true, createdDay: day,
      };
      ensureResidence(world, hid, { grade: tier >= 3 ? 7 : 3 });
    }
    const members = [
      { role: '老爷', gender: 'male', age: 48, money: 400 + Math.random() * 600 },
      { role: '夫人', gender: 'female', age: 44, money: 120 },
      { role: idx % 2 === 0 ? '公子' : '小姐', gender: idx % 2 === 0 ? 'male' : 'female', age: 19 + Math.floor(Math.random() * 5), money: 30 },
    ];
    // tier≥2：儿女双全（补上与已有孩子不同的那一个）
    if (tier >= 2) {
      const hasSon = members.some((m) => m.role === '公子');
      const hasGirl = members.some((m) => m.role === '小姐');
      if (!hasSon) members.push({ role: '公子', gender: 'male', age: 21, money: 30 });
      if (!hasGirl) members.push({ role: '小姐', gender: 'female', age: 17, money: 20 });
    }
    for (const m of members) {
      const aid = `${slug}_gentry_${idx}_${m.role}_${m.age}`;
      if (world.actors[aid]) continue;
      world.actors[aid] = {
        id: aid, name: given(m.gender), role: m.role, title: m.role, gender: m.gender,
        age: m.age, home: hid, location: hid, money: Math.round(m.money * 100) / 100,
        household: true, relations: {}, origin: 'city_class', createdDay: day,
        spouse: null,
      };
      made += 1;
    }
    // 父母结成夫妻
    const lord = world.actors[`${slug}_gentry_${idx}_老爷`];
    const lady = world.actors[`${slug}_gentry_${idx}_夫人`];
    if (lord && lady) { lord.spouse = lady.id; lady.spouse = lord.id; lord.marital = 'married'; lady.marital = 'married'; }
    // 仆役两名
    for (let k = 0; k < 2; k += 1) {
      const sid = `${slug}_servant_${idx}_${k}`;
      if (world.actors[sid]) continue;
      const nm = fallbackName(world, k === 0 ? 'female' : 'male');
      if (!nm) continue;
      world.actors[sid] = {
        id: sid, name: nm, role: k === 0 ? '丫鬟' : '家丁', title: k === 0 ? '丫鬟' : '家丁',
        gender: k === 0 ? 'female' : 'male', age: 16 + k * 4,
        home: hid, location: hid, money: 0.4 + Math.random(), servant: true,
        relations: {}, origin: 'city_class', createdDay: day,
      };
      made += 1;
    }
  };

  const families = tier >= 3 ? 2 : 1;
  for (let i = 0; i < families; i += 1) addFamily(i + 1);

  // 富商（独立于大户）
  for (let i = 0; i < 1; i += 1) {
    const mid = `${slug}_tycoon_${i}`;
    if (!world.actors[mid]) {
      const nm = fallbackName(world, 'male');
      if (nm) {
        world.actors[mid] = {
          id: mid, name: nm, role: '富商', title: '富商', gender: 'male',
          age: 38 + Math.floor(Math.random() * 12), home: b.streetId, location: b.marketId,
          money: 300 + Math.random() * 500, relations: {}, origin: 'city_class', createdDay: day,
        };
        made += 1;
      }
    }
  }
  // 才女（书香门第，独立一位）
  const girlId = `${slug}_poetess`;
  if (!world.actors[girlId]) {
    const nm = fallbackName(world, 'female');
    if (nm) {
      world.actors[girlId] = {
        id: girlId, name: nm, role: '才女', title: '才女', gender: 'female',
        age: 18, home: b.streetId, location: b.streetId, money: 12,
        relations: {}, origin: 'city_class', createdDay: day,
      };
      made += 1;
    }
  }

  b.classesDone = { at: Date.now(), made };
  console.log(`[City] ${city} 阶级生成：大户 ${families} 户、富商 1、才女 1，共 ${made} 人`);
  __world = null;
  return made;
}
