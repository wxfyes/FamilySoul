/**
 * 姻亲：说亲、婚配、结亲。
 *
 * 规矩：
 *   ① 婚配不是剧情道具：两个成年未婚男女，同在一城，才谈得上；
 *   ② 说亲要经媒婆、要聘礼，成不成看人家愿不愿意（信任/彩礼）；
 *   ③ 婚后写进 spouse 与 bonds，两家的姻亲关系跟着走。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const labelOf = (nm, world) => {
  const seg = String(nm || '').split('·')[0];
  if (/府$|州$|县$/.test(seg) && world?.cities?.[seg]) return seg;
  return '临江府';
};

const cityOf = (world, actor) => {
  const byName = labelOf(world.places?.[actor?.location]?.name, world);
  if (byName !== '临江府') return byName;
  // 老宅名没带城（如"裴府"）：按 home 的 id 前缀认城
  const hid = String(actor?.home || '');
  for (const c of Object.keys(world?.cities || {})) {
    const slug = c.replace(/府$|县$|州$/g, '');
    if (hid.startsWith(`${slug}_`)) return c;
  }
  return byName;
};

/** 一城一个媒婆（没有就补） */
export function ensureMatchmaker(world, cityName) {
  const city = String(cityName || '');
  const b = world?.flags?.cityBase?.[city];
  if (!b) return null;
  const slug = city.replace(/府$|县$|州$/g, '');
  const id = `${slug}_matchmaker`;
  if (world.actors?.[id]) return world.actors[id];
  const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
  let name = '';
  for (let i = 0; i < 20; i += 1) {
    const cand = `${['王', '李', '张', '刘', '陈', '赵', '孙', '周'][Math.floor(Math.random() * 8)]}媒婆`;
    if (!usedNames.has(cand)) { name = cand; break; }
  }
  if (!name) name = `${city}媒婆`;
  world.actors[id] = {
    id, name, role: '媒婆', title: '媒婆', gender: 'female',
    age: 45 + Math.floor(Math.random() * 15),
    home: b.streetId, location: b.streetId, money: 1.5, relations: {},
    origin: 'city_base',
  };
  console.log(`[Marriage] ${city}补了个媒婆：${name}`);
  return world.actors[id];
}

/** 这人能说亲吗 */
export function isMarriageable(world, a) {
  if (!a || a.dead || a.jailed) return false;
  if (a.spouse) return false;
  if (String(a.marital || '') === 'married') return false;
  const age = num(a.age);
  if (age && (age < 16 || age > 45)) return false;
  if (a.id === 'husband') return false;
  if (String(a.id).startsWith('usr_')) return false;

  // 严禁核心预设角色与王家眷属参与民间随机拉郎配
  if (a.origin === 'preset' || a.household === true || a.spouse === 'husband') return false;

  // 严禁千金名门闺秀、花魁才女被市井民间系统私自搭桥婚配（婚配必须走提亲/八抬大轿大礼）
  const roleText = String(a.role || '');
  if (/千金|小姐|闺秀|才女|花魁|花魁娘子|行首/.test(roleText)) return false;

  return true;
}

/**
 * 相公说亲：成不成看对方意愿与聘礼
 * @returns {{ok:boolean, line:string}}
 */
export function proposeMarriage(world, suitorId, targetId, gift = 2) {
  const suitor = world.actors?.[suitorId];
  const target = world.actors?.[targetId];
  if (!suitor || !target) return { ok: false, line: '（没这个人。）' };
  if (!isMarriageable(world, target)) return { ok: false, line: `（${target.name}不是能说亲的人。）` };
  if (cityOf(world, suitor) !== cityOf(world, target)) return { ok: false, line: `（${target.name}不在本城，说亲得当面。）` };

  const rel = target.relations?.[suitorId] || {};
  const trust = num(rel.trust);
  const giftNum = num(gift);

  // 门第：大户小姐、才女，家里要门当户对——交情与聘礼都得够
  const gentle = /小姐|才女|闺秀|千金/.test(String(target.role || ''));
  if (gentle) {
    const props = (world.assets?.properties || []).filter((x) => x && (String(x.owner || '') === String(suitorId) || String(x.keeper || '') === String(suitorId))).length;
    const fame = Number(world.actors?.[suitorId]?.fame || 0);
    const standing = props >= 1 || fame >= 15;
    if (trust < 40 || giftNum < 20) {
      return { ok: false, line: `（${target.name}家里要门当户对：先与她说得上话（交情${Math.round(trust)}/40），聘礼也不能寒酸（${giftNum.toFixed(0)}/20 两）。）` };
    }
    if (!standing) {
      return { ok: false, line: `（${target.name}的父亲摇了摇头：你家底还薄，先立起一处产业再来提亲。）` };
    }
  }

  const chance = Math.min(0.95, 0.15 + trust / 100 + Math.min(0.4, giftNum / 20));
  const accepted = Math.random() < chance;
  if (!accepted) {
    return { ok: false, line: `（${target.name}低了低头，说这桩事还得再想想。）` };
  }
  // 结亲
  suitor.spouse = target.id;
  target.spouse = suitor.id;
  suitor.marital = 'married';
  target.marital = 'married';
  if (target.home) {
    target.oldHome = target.home;
    target.home = suitor.home || target.home;
    if (suitor.home && world.places?.[suitor.home]) target.location = suitor.home;
  }
  try {
    world.bonds = world.bonds || {};
    world.bonds[suitor.id] = world.bonds[suitor.id] || {};
    world.bonds[target.id] = world.bonds[target.id] || {};
    world.bonds[suitor.id][target.id] = { type: '姻亲', score: 60 };
    world.bonds[target.id][suitor.id] = { type: '姻亲', score: 60 };
  } catch { /* 忽略 */ }
  console.log(`[Marriage] ${suitor.name} 娶了 ${target.name}（聘礼 ${giftNum} 两）`);
  return { ok: true, line: `（媒婆两头跑了几趟，${target.name}点了头。这桩亲事成了。）` };
}

/**
 * 民间自己结亲：每天给几对同城未婚男女搭桥
 * @returns {number} 成了几对
 */
export function dailyMarriages(world) {
  const day = num(world.clock?.day) || 1;
  world.flags = world.flags || {};
  if (num(world.flags.marriageDay) === day) return 0;
  world.flags.marriageDay = day;

  const pool = Object.values(world?.actors || {}).filter((a) => isMarriageable(world, a) && a.household !== true);
  let pairs = 0;
  for (const a of pool) {
    if (pairs >= 3) break;
    if (a.spouse) continue;
    const cands = pool.filter((b) => b.id !== a.id && !b.spouse
      && ((a.gender === 'female') !== (b.gender === 'female'))
      && cityOf(world, b) === cityOf(world, a)
      && Math.abs(num(a.age) - num(b.age)) <= 15);
    if (!cands.length) continue;
    const b = cands[Math.floor(Math.random() * cands.length)];
    a.spouse = b.id;
    b.spouse = a.id;
    a.marital = 'married';
    b.marital = 'married';
    try {
      world.bonds = world.bonds || {};
      world.bonds[a.id] = world.bonds[a.id] || {};
      world.bonds[b.id] = world.bonds[b.id] || {};
      world.bonds[a.id][b.id] = { type: '姻亲', score: 55 };
      world.bonds[b.id][a.id] = { type: '姻亲', score: 55 };
    } catch { /* 忽略 */ }
    console.log(`[Marriage] ${cityOf(world, a)}：${a.name} 与 ${b.name} 结亲`);
    pairs += 1;
  }
  return pairs;
}


const standingOf = (world, actorId) => {
  const props = (world.assets?.properties || []).filter((x) => x && (String(x.owner || '') === String(actorId) || String(x.keeper || '') === String(actorId)));
  const silver = Number(world.assets?.silver) || 0;
  const fame = Number(world.actors?.[actorId]?.fame || 0);
  return { props: props.length, silver, fame, score: props * 3 + silver / 100 + fame / 5 };
};

/**
 * 大户人家主动来联姻：你在这城里站稳了，人家才来问
 * @returns {object|null} 新的提亲
 */
export function maybeOfferAlliance(world, playerId = 'husband', force = false) {
  const day = num(world.clock?.day) || 1;
  world.flags = world.flags || {};
  if (num(world.flags.allianceCheckedDay) === day) return null;
  world.flags.allianceCheckedDay = day;
  if (world.flags.allianceOffer) return world.flags.allianceOffer;

  const player = world.actors?.[playerId];
  if (!player) return null;
  const city = cityOf(world, player);
  const me = standingOf(world, playerId);

  // 自己得先立住：三处产业，或银子上千，或名声在外
  if (!(me.props >= 3 || me.silver >= 1000 || me.fame >= 30)) return null;
  if (!force && Math.random() > 0.45) return null;

  // 只挑"有府邸、有老爷做主"的人家，别把街上独居的才女当成大户提亲
  const girls = Object.values(world?.actors || {}).filter((a) => a && !a.dead
    && /小姐|才女/.test(String(a.role || '')) && isMarriageable(world, a)
    && cityOf(world, a) === city)
    .filter((a) => {
      const h = world.places?.[a.home];
      if (!h?.residence) return false;
      return Object.values(world.actors || {}).some((x) => x && x.role === '老爷' && x.home === a.home);
    });
  if (!girls.length) return null;
  const girl = girls[Math.floor(Math.random() * girls.length)];
  const family = girl.home && world.places?.[girl.home];
  const lord = Object.values(world.actors || {}).find((a) => a && a.home === girl.home && a.role === '老爷');

  world.flags.allianceOffer = {
    girlId: girl.id, girlName: girl.name, familyId: girl.home,
    familyName: family?.name || '某府', lordName: lord?.name || '',
    city, day, status: 'pending',
  };
  console.log(`[Marriage] ${family?.name || ''} 托媒婆来提亲：欲将 ${girl.name} 许给 ${player.name}`);
  return world.flags.allianceOffer;
}

/** 答应联姻：小姐进门做侧室，两家结姻亲 */
export function acceptAlliance(world, playerId = 'husband') {
  const offer = world.flags?.allianceOffer;
  if (!offer || offer.status !== 'pending') return { ok: false, line: '（眼下没有人家来提亲。）' };
  const girl = world.actors?.[offer.girlId];
  const player = world.actors?.[playerId];
  if (!girl || !player) return { ok: false, line: '（这门亲事已经作罢。）' };
  girl.household = true;
  girl.spouse = playerId;
  girl.marital = 'concubine';
  girl.oldHome = girl.home;
  girl.home = player.home || girl.home;
  girl.location = player.home || girl.location;
  player.spouse = player.spouse || girl.id;
  try {
    world.bonds = world.bonds || {};
    world.bonds[playerId] = world.bonds[playerId] || {};
    world.bonds[girl.id] = world.bonds[girl.id] || {};
    world.bonds[playerId][girl.id] = { type: '姻亲', score: 65 };
    world.bonds[girl.id][playerId] = { type: '姻亲', score: 65 };
  } catch { /* 忽略 */ }
  offer.status = 'accepted';
  world.flags.allianceOffer = null;
  console.log(`[Marriage] 联姻成了：${girl.name} 入 ${player.name} 家`);
  return { ok: true, line: `（${offer.familyName}择日送了 ${girl.name} 过门，两家成了姻亲。）` };
}

/** 回绝 */
export function declineAlliance(world) {
  const offer = world.flags?.allianceOffer;
  if (!offer) return { ok: false, line: '（眼下没有人家来提亲。）' };
  world.flags.allianceOffer = null;
  console.log(`[Marriage] 回绝了 ${offer.familyName} 的提亲`);
  return { ok: true, line: `（${offer.familyName}的媒婆悻悻走了。）` };
}
