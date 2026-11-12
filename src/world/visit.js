/**
 * 门房规矩：外人不许直闯内院，得走「递帖 — 通禀 — 允入」。
 *
 * 规矩只看三件事（不写死人名）：
 *   ① 这是谁的宅子（residence.owner）
 *   ② 来人与主人是什么交情（relations.trust / desire / 是否本家）
 *   ③ 眼下的时辰与风声（夜里闭门、官府拿人时不放生客）
 *
 * 允了：给他一张「门籍」（pass），当场放进中堂/正厅；
 * 不允：留在大门，由门房回一句实在话（谁不在、几时再来、递帖候着）。
 */

import { gatekeeperOf } from './posts.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 从任意地点往上找到它所属的宅子（父地点链只有一层，够用） */
export function residenceOf(world, placeId) {
  let p = world?.places?.[placeId];
  if (!p) return null;
  if (p.residence) {
    if (!p.id) p.id = placeId;
    return p;
  }
  let guard = 0;
  while (p && p.parent && guard < 4) {
    const parentKey = p.parent;
    const parent = world.places?.[parentKey];
    if (!parent) break;
    if (parent.residence) {
      if (!parent.id) parent.id = parentKey;
      return parent;
    }
    p = parent;
    guard += 1;
  }
  if (p && p.residence) {
    if (!p.id) p.id = placeId;
    return p;
  }
  return null;
}

/** 这门亲不亲：本家、姻亲、老交情，各有各的待遇 */
export function relationTo(world, ownerId, visitorId) {
  if (!ownerId || !visitorId) return { trust: 0, kin: false };
  if (ownerId === visitorId) return { trust: 100, kin: true };
  const owner = world.actors?.[ownerId];
  const visitor = world.actors?.[visitorId];
  let kin = Boolean(
    (owner && visitor && (owner.spouse === visitorId || visitor.spouse === ownerId))
    || (visitor?.household && owner?.household)
    || (Array.isArray(visitor?.relations?.[ownerId]?.tags) && visitor.relations[ownerId].tags.includes('kin')),
  );
  let trust = Math.max(
    num(visitor?.relations?.[ownerId]?.trust),
    num(owner?.relations?.[visitorId]?.trust),
  );

  // 家族眷属亲情连带：相公访友时，若宅中千金/眷属与相公互许心意（如知府千金杨采儿与相公信任90），信任与亲缘连通
  if (visitorId === 'husband' && owner) {
    const daughterId = owner.daughter;
    if (daughterId && world.actors?.[daughterId]) {
      const d = world.actors[daughterId];
      const dTrust = Math.max(num(visitor?.relations?.[daughterId]?.trust), num(d?.relations?.[visitorId]?.trust));
      if (dTrust > trust) trust = dTrust;
      if (dTrust >= 60) kin = true;
    }
    const fatherId = owner.father;
    if (fatherId && world.actors?.[fatherId]) {
      const f = world.actors[fatherId];
      const fTrust = Math.max(num(visitor?.relations?.[fatherId]?.trust), num(f?.relations?.[visitorId]?.trust));
      if (fTrust > trust) trust = fTrust;
    }
  }

  return { trust, kin };
}

/**
 * 叫门：能不能进
 * @returns {{allowed:boolean, reason:string, place:string|null, owner:string, hall:string|null}}
 */
export function knock(world, visitorId, residenceId) {
  const home = world?.places?.[residenceId];
  if (!home || !home.residence) return { allowed: false, reason: '这不是私宅', place: null, owner: '', hall: null };
  const owner = String(home.owner || '');
  const keeper = gatekeeperOf(world, home.id);
  const keeperName = keeper?.name || '';
  const gateId = home.rooms?.gate?.id || null;
  const keeperAtGate = Boolean(keeper && gateId && keeper.location === gateId);
  const visitor = world.actors?.[visitorId];
  if (!owner) return { allowed: false, reason: '这宅子眼下没有主事的人', place: null, owner: '', hall: null };
  if (owner === visitorId) return { allowed: true, reason: '自己的宅子', place: home.id, owner, hall: null };

  const { trust, kin } = relationTo(world, owner, visitorId);
  const hour = num(world.clock?.hour);
  const night = hour >= 21 || hour < 6;
  const wanted = num(visitor?.wanted) || num(world.factions?.yamen?.wanted);
  const ownerHere = String(world.actors?.[owner]?.location || '').includes(home.id)
    || (home.rooms && Object.values(home.rooms).some((r) => r?.id === world.actors?.[owner]?.location));

  if (wanted > 0) return { allowed: false, reason: `${keeperName || '门房'}看你面生，又听说衙门在拿人，只肯留你在门外候着`, place: null, owner, hall: null, keeper: keeperName };
  // 夜里也能通传：有看门的，披衣起来问一声；真有急事，主人让进就进
  if (night && !kin && trust < 60) {
    if (!keeper) return { allowed: false, reason: '夜里没人应门，里头都歇下了，请明早再来', place: null, owner, hall: null, keeper: '' };
    if (!ownerHere) {
      return { allowed: false, reason: `${keeperName}披衣起来应了门，说主人不在府里，有急事可留下话、明早再递`, place: null, owner, hall: null, keeper: keeperName };
    }
    const hallKeyN = ['hall', 'main', 'reception'].find((k) => home.rooms?.[k]);
    const hallN = hallKeyN ? home.rooms[hallKeyN].id : null;
    return { allowed: true, reason: `${keeperName}披衣起来通了传，主人听说有急事，让请进偏厅说话`, place: hallN || home.id, owner, hall: hallN, keeper: keeperName };
  }
  if (!ownerHere && trust < 50) return { allowed: false, reason: keeperAtGate ? `${keeperName}说主人不在府里，不敢擅自放人进去` : '门前无人，主人也不在府里', place: null, owner, hall: null, keeper: keeperName };

  // 放进去：中堂/正厅优先，其次正房，再其次大门内的门房
  const rooms = home.rooms || {};
  const hallKey = ['hall', 'main', '正厅', '中堂'].find((k) => rooms[k]);
  const hallId = hallKey ? rooms[hallKey].id : (rooms.main?.id || rooms.gate?.id || null);
  // 白天且主人在家：生客也放进中堂（主人家自己看着办）；内院/卧房仍要交情
  const dayTime = hour >= 6 && hour < 21;
  const allowed = kin || trust >= 40 || (dayTime && ownerHere);
  if (!allowed) {
    return { allowed: false, reason: keeperAtGate ? `${keeperName}进去回了话，主人说与你不相熟，改日再会` : '主人说与你不相熟，改日再会', place: null, owner, hall: hallId, keeper: keeperName };
  }
  return { allowed: true, reason: kin ? '自家人，门房忙让进中堂' : (keeperAtGate ? `${keeperName}递了帖，主人说请进` : '主人说请进'), place: hallId || home.id, owner, hall: hallId, keeper: keeperName };
}

/** 放行条：允入之后记一笔，出门即失效 */
export function grantPass(world, visitorId, residenceId, day) {
  const a = world.actors?.[visitorId];
  if (!a) return;
  a.pass = { to: residenceId, day: num(day) || 1 };
}

export function hasPass(world, visitorId, residenceId) {
  const a = world.actors?.[visitorId];
  const pass = a?.pass;
  if (!pass || pass.to !== residenceId) return false;
  const day = num(world.clock?.day) || 1;
  if (num(pass.day) !== day) { delete a.pass; return false; }
  return true;
}

export function clearPass(world, visitorId) {
  const a = world.actors?.[visitorId];
  if (a) delete a.pass;
}
