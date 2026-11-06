/**
 * 内宅门第：后宅（正房/厢房/后院/祠堂）不是谁都能进的。
 *
 * 规矩：
 *   ① 本家（住在这府的家人、下人）随便走；
 *   ② 外人只有被主人"叫进来"才进得去（当日有效）；
 *   ③ 已经混进来的外人，巡检时会请出去（不靠谁下令，自己会清）。
 *
 * 判定只看数据：房间的 access、人的 household/home、当日的请帖。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 这间房是不是后宅（外人止步） */
export function isInnerRoom(place) {
  const access = String(place?.access || '');
  return access.startsWith('family') || access === 'servant_utility';
}

/** 这间房归哪座宅子（父地点链） */
export function homeOf(world, place) {
  let p = place;
  let guard = 0;
  while (p && p.parent && guard < 4) {
    const par = world?.places?.[p.parent];
    if (!par) break;
    if (par.residence) return par;
    p = par;
    guard += 1;
  }
  return p && p.residence ? p : null;
}

/** 这人是这府的人吗（家人或府里的下人） */
export function belongsTo(world, actor, home) {
  if (!actor || !home) return false;
  // 宅子的主人当然是本家（否则自己的正房反而进不去）
  if (home.owner && String(home.owner) === String(actor.id)) return true;
  if (String(actor.home || '') === String(home.id)) return true;
  if (actor.household && String(home.owner || '') === 'husband') return true;
  const duty = actor.duty;
  if (duty && String(duty.home || '') === String(home.id)) return true;
  return false;
}

/** 今日请帖：主人叫进来的人，当日有效 */
export function invitedToday(world, actor, home) {
  const inv = actor?.invitedTo;
  if (!inv) return false;
  const day = num(world.clock?.day) || 1;
  return String(inv.home || '') === String(home?.id) && num(inv.day) === day;
}

export function giveInvite(world, actorId, homeId) {
  const a = world?.actors?.[actorId];
  if (!a) return false;
  a.invitedTo = { home: String(homeId), day: num(world.clock?.day) || 1 };
  return true;
}

export function clearInvite(world, actorId) {
  const a = world?.actors?.[actorId];
  if (a) delete a.invitedTo;
}

/**
 * 巡检：把混进后宅的外人请出去
 * @returns {number} 请出去的人数
 */
export function evictOutsiders(world) {
  let n = 0;
  for (const a of Object.values(world?.actors || {})) {
    if (!a || a.dead || !a.location) continue;
    const place = world.places?.[a.location];
    if (!place || !isInnerRoom(place)) continue;
    const home = homeOf(world, place);
    if (!home) continue;
    if (belongsTo(world, a, home) || invitedToday(world, a, home)) continue;
    // 真人自己走进去的，不动他（由客户端/玩家负责），只清 NPC
    if (String(a.id).startsWith('usr_')) continue;
    const out = home.rooms?.gate?.id || home.rooms?.hall?.id || 'street';
    if (!world.places?.[out]) continue;
    a.location = out;
    delete a.activity;
    n += 1;
    console.log(`[Gate] 后宅清人：${a.name} 被请出${home.name || home.id}内院`);
  }
  return n;
}
