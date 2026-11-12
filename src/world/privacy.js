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
  if (!place) return false;
  const access = String(place?.access || '');
  const id = String(place?.id || '');
  const name = String(place?.name || '');
  if (id === 'husband_room' || id.startsWith('wang_mansion_') || /正房|暖阁|卧房|闺房|东跨院|西厢房/.test(name)) return true;
  return access.startsWith('family') || access === 'servant_utility' || access === 'staff_only' || access === 'guest_room';
}

/** 这间房是不是主人与妻妾起居寝卧的私密闺房（下人、伙计、外人绝对止步） */
export function isChamberRoom(place) {
  if (!place) return false;
  const id = String(place?.id || '');
  const name = String(place?.name || '');
  return id === 'husband_room'
    || id === 'wang_mansion_west'
    || id === 'wang_mansion_east'
    || /正房|卧房|寝室|闺房|东跨院|西厢房|暖阁/.test(name);
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
  if (home.id === 'yang_mansion' && (actor.id === 'yangshenzhi' || actor.id === 'yangzhenhua' || actor.id === 'luchen')) return true;
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
    if (!place) continue;

    const home = homeOf(world, place);

    // 1. 私密寝室闺房铁律：即便属于本府下人（家丁、护院、门房、伙计、跑堂），未经相公特召绝不许滞留正房/厢房主卧
    if (isChamberRoom(place)) {
      const isMasterFamily = a.id === 'husband'
        || ['waner', 'yunnia', 'xiaocui'].includes(a.id)
        || /正妻|二房|如夫人|侧室|侍妾|通房/.test(String(a.role || ''));
      if (!isMasterFamily && !invitedToday(world, a, home)) {
        if (String(a.id).startsWith('usr_')) continue;
        let dest = 'street';
        if (/伙计|跑堂/.test(String(a.role || ''))) {
          dest = world.places?.tea_house ? 'tea_house' : (world.places?.['place_44__f1'] ? 'place_44__f1' : 'street');
        } else if (/家丁|护院|门房|小厮|车夫|马夫/.test(String(a.role || ''))) {
          dest = home?.rooms?.gate?.id || home?.rooms?.gatehouse?.id || 'husband_room__gate';
        } else {
          dest = home?.rooms?.hall?.id || home?.rooms?.gate?.id || 'street';
        }
        if (!world.places?.[dest]) {
          dest = world.places?.tea_house ? 'tea_house' : 'street';
        }
        a.location = dest;
        delete a.activity;
        n += 1;
        console.log(`[Chamber] 私密正房清场：${a.name}（${a.role}）被请出寝堂，移至${world.places?.[dest]?.name || dest}`);
        continue;
      }
    }

    if (!isInnerRoom(place)) continue;
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
