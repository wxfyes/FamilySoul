/**
 * 府里的差事：谁守门、谁听差、谁管账。
 *
 * 规矩：
 *   ① 差事记在人身上（actor.duty），不记在房间上，换人只改一个字段；
 *   ② 门房不是凭空多出来的：得从府里已经有的人里挑一个（家丁、护院、管事、仆役）；
 *   ③ 没有合适的人，就没人守门——访客只能自己叩门，里面未必应。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const GATE_ROLE = /门房|家丁|护院|管事|管家|仆|小厮|老仆/;

/** 这府里有没有能派去看门的人（按位份挑，不写死姓名） */
export function gateCandidates(world, residenceId) {
  const home = world?.places?.[residenceId];
  if (!home) return [];
  return Object.values(world.actors || {}).filter((a) => {
    if (!a || a.dead || a.id === 'husband') return false;
    if (String(a.home || '') !== String(residenceId)) return false;
    if (a.household) return false;            // 主子不看门
    return GATE_ROLE.test(String(a.role || '')) || a.servant === true;
  });
}

/** 这府的门房是谁（没有就 null） */
export function gatekeeperOf(world, residenceId) {
  const home = world?.places?.[residenceId];
  if (!home) return null;
  const staff = Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.duty && a.duty.post === 'gate' && String(a.duty.home || '') === String(residenceId),
  );
  if (!staff.length) return null;
  // 首选此刻就在大门那一间的
  const gateId = home.rooms?.gate?.id;
  return staff.find((a) => a.location === gateId) || staff[0];
}

/**
 * 给这府派一个门房（幂等：已经有人就不动）
 * @returns {{ok:boolean, actorId?:string, name?:string, reason?:string}}
 */
export function ensureGatekeeper(world, residenceId) {
  const home = world?.places?.[residenceId];
  if (!home) return { ok: false, reason: '没有这座宅子' };
  const existing = gatekeeperOf(world, residenceId);
  if (existing) return { ok: true, actorId: existing.id, name: existing.name };
  const pool = gateCandidates(world, residenceId);
  if (!pool.length) return { ok: false, reason: '府里没有可派去看门的人' };
  // 挑最闲的一个（不挑正在当差别的事的）
  pool.sort((a, b) => num(a.duty?.since) - num(b.duty?.since));
  const pick = pool[0];
  pick.duty = { post: 'gate', home: String(residenceId), since: num(world.clock?.day) || 1 };
  console.log(`[Duty] ${pick.name} 派去看门（${home.name || home.id}）`);
  return { ok: true, actorId: pick.id, name: pick.name };
}

/** 撤掉这府的门房差事（人还在，只是不守门了） */
export function relieveGatekeeper(world, residenceId) {
  let n = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    if (a.duty && a.duty.post === 'gate' && String(a.duty.home || '') === String(residenceId)) {
      delete a.duty;
      n += 1;
    }
  }
  return n;
}

/** 门房此刻该在哪：白天守大门，夜里回下房 */
export function gatePostPlace(world, actor) {
  const homeId = actor?.duty?.home;
  const home = world?.places?.[homeId];
  if (!home) return null;
  const hour = num(world.clock?.hour);
  const day = hour >= 6 && hour < 21;
  if (day) return home.rooms?.gate?.id || null;
  return actor.quarters || home.rooms?.servant?.id || null;
}
