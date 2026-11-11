/**
 * 「去哪儿」的唯一出处。
 *
 * 天道的台词里说的是"东厢""后院""码头""街市"这些人话，
 * 引擎要把它翻成世界里真实存在的地点 id。
 *
 * 规则：
 *   ① 先按语义词找候选（东厢/后院/码头/酒楼/茶山/衙/仓/街市…）；
 *   ② 在同名候选里，优先挑离他近的（同主人/同街区/非私宅）；
 *   ③ 找不到就回街市；街市也没有，就回他自己家。
 * 绝不写死任何 place id。
 */

import { materializeRoom } from './residence.js';
import { streetOfCity, cityOfPlace } from './city.js';

const SEMANTICS = [
  { key: '地窖', test: /酒窖|地窖|窖/ },
  { key: '天字阁', test: /天字|三楼|三层|雅阁/ },
  { key: '后厨', test: /后厨|厨房|砧板/ },
  { key: '大堂', test: /大堂|散座|柜台|前店/ },
  { key: '酒楼', test: /酒楼|酒肆|饭庄/ },
  { key: '码头', test: /码头|渡口|船坞|河埠/ },
  { key: '茶山', test: /茶山|茶园|山场/ },
  { key: '东厢', test: /东厢|东院|东跨院|东房|东屋|书房/ },
  { key: '西厢', test: /西厢|西院|西跨院|西房|西屋/ },
  { key: '后院', test: /后院|花园|庖厨|灶房|下房|暖阁/ },
  { key: '祠堂', test: /祠堂|家庙/ },
  { key: '马厩', test: /马厩|马房|车马/ },
  { key: '库房', test: /库房|柴房|官仓|仓/ },
  { key: '衙门', test: /衙门|县衙|府衙|公堂/ },
  { key: '客栈', test: /客栈|旅店|驿/ },
  { key: '街市', test: /街|市|坊|集/ },
];

function placeList(world) {
  return Object.entries(world?.places || {}).map(([id, p]) => ({ id, ...(p || {}) }));
}

/** 候选排序：离他近的、不是别人私宅的优先 */
let __myCity = '';
function score(p, nearId, actor, hint = '') {
  let s = 0;
  const labelOf = (nm) => {
    const seg = String(nm || '').split('·')[0];
    return /府$|州$|县$/.test(seg) ? seg : '临江府';
  };
  const pc = labelOf(p.name);
  if (__myCity && pc !== __myCity) s -= 8;   // 别把人送到别的城
  if (__myCity && pc === __myCity) s += 4;
  if (hint && p.name && String(p.name).includes(hint)) s += 6;
  // 别把"衙门"认成"县衙前茶摊"这类带茶/摊/铺的边角地点
  if (/茶|摊|铺|店|集/.test(String(p.name || '')) && !/茶|摊|铺|店|集/.test(hint)) s -= 5;
  if (p.id === nearId) s += 3;
  if (nearId && Array.isArray(p.exits) && p.exits.includes(nearId)) s += 2;
  if (p.residence) s -= 2;
  if (actor?.home === p.id) s += 4;
  if (!p.residence) s += 1;
  return s;
}

/**
 * 把一句"人话"翻译成真实地点
 * @returns {string} placeId（一定存在于 world.places 里）
 */
export function resolvePlaceTarget(world, hint, { nearId = '', actor = null } = {}) {
  const places = placeList(world);
  if (!places.length) return null;
  const text = String(hint || '');
  __myCity = nearId ? (() => {
    const seg = String(world?.places?.[nearId]?.name || '').split('·')[0];
    return /府$|州$|县$/.test(seg) ? seg : '临江府';
  })() : '';

  // 说的是"哪座城"：先到那座城的主街（跨城靠这个认）
  try {
    for (const cn of Object.keys(world?.cities || {})) {
      const base = cn.replace(/府$|县$|州$/g, '');
      const t3 = text.trim();
      const bare = t3 === cn || t3 === base || (!t3.includes('·') && t3.includes(cn));
      if (!bare) continue;
      const sid = streetOfCity(world, cn);
      if (sid) return sid;
    }
  } catch { /* 忽略 */ }

  // 说的是"人"（去找王甯）：先落到他现在所在的地方，再由门禁决定能不能进
  try {
    const person = Object.values(world?.actors || {}).find(
      (a) => a && !a.dead && a.name && (a.name === text || text.includes(a.name) || a.name.includes(text)),
    );
    if (person && world.places?.[person.location]) return person.location;
  } catch { /* 忽略 */ }

  // 王宅专属厢房与跨院精准直达（优先级必须高于王宅大院，避免"王宅·东跨院"被王宅截胡成大门）
  if (/东厢|东院|东跨/.test(text) && world.places?.wang_mansion_east) return 'wang_mansion_east';
  if (/西厢|西院|西跨/.test(text) && world.places?.wang_mansion_west) return 'wang_mansion_west';

  // 王宅（含七进大宅院/王家大宅这种产业名）一律回丈夫正房，绝不另辟孤岛；只有明确提大门才去大门
  if (/王宅|王家大宅|七进大宅|王家庭院/.test(text)) {
    if (/门|大门|门头|门房|照壁/.test(text) && world.places?.husband_room__gate) return 'husband_room__gate';
    if (world.places?.husband_room) return 'husband_room';
  }

  // ① 天道的暗示里直接点了某个地点的名字
  const byName = places
    .filter((p) => p.name && text.includes(String(p.name).slice(0, 3)))
    .sort((a, b) => score(b, nearId, actor, text) - score(a, nearId, actor, text));
  if (byName.length) return byName[0].id;

  // ② 按语义类别找
  for (const sem of SEMANTICS) {
    if (!sem.test.test(text)) continue;
    let cands = places.filter((p) => p.name && sem.test.test(String(p.name)));
    // 牢房隔离铁律：去衙门/官署/公堂等正常官衙，绝对严禁被县衙男牢/女牢截胡！
    if (sem.key === '衙门') {
      cands = cands.filter((p) => !/牢|狱|死牢|囚/.test(String(p.name || '')) && !String(p.id).startsWith('jail_'));
    }
    if (cands.length) {
      cands.sort((a, b) => score(b, nearId, actor, text) - score(a, nearId, actor, text));
      return cands[0].id;
    }
  }

  // ②.5 室内去处：在自己的宅院里找（厢房/下房/花园/庖厨），找不到就回自己家
  if (/房|厢|院|阁|厨|库|屋|祠|厩/.test(text)) {
    const homePlace = actor?.home ? world.places?.[actor.home] : null;
    const mansionKey = homePlace?.name ? String(homePlace.name).split('·').find((x) => /宅|府|院/.test(x)) || '' : '';
    const inside = places.filter((p) => p.name && /房|厢|院|阁|厨|库|屋/.test(String(p.name))
      && (p.residence || (mansionKey && String(p.name).includes(mansionKey))));
    if (inside.length) {
      inside.sort((a, b) => score(b, nearId, actor, text) - score(a, nearId, actor, text));
      return inside[0].id;
    }
    if (actor?.home && world.places?.[actor.home]) return actor.home;
  }

  // ②.7 房间在"账"上还没展开：按名字找到就展开
  try {
    for (const [pid, pl] of Object.entries(world?.places || {})) {
      if (!pl || !pl.rooms) continue;
      for (const [key, rec] of Object.entries(pl.rooms)) {
        if (!rec || !rec.name) continue;
        if (!text.includes(rec.name) && !text.includes(String(rec.name).slice(0, 2))) continue;
        const made = materializeRoom(world, pid, key);
        if (made) { console.log(`[Room] 展开 ${pl.name}·${rec.name}`); return made; }
      }
    }
  } catch { /* 忽略 */ }

  // ③ 兜底：街市 → 他自己家 → 任何非私宅
  const street = places.find((p) => p.id === 'street') || places.find((p) => /街/.test(String(p.name)));
  if (street) return street.id;
  const home = actor?.home && world.places?.[actor.home] ? actor.home : null;
  if (home) return home;
  const open = places.find((p) => !p.residence);
  return (open || places[0]).id;
}

/** 这一步是否"出府"（跨出私宅） */
export function isOuting(world, fromId, toId) {
  const from = world?.places?.[fromId];
  const to = world?.places?.[toId];
  if (!to) return false;
  if (!from) return true;
  return Boolean(from.residence) && !to.residence;
}
