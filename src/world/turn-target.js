/**
 * 这一轮该谁说话：唯一的判定处。
 * 优先级：被点名的在场者 > 上次的对话对象 > 王甯（被点名或没人可对时）。
 * 都不满足 → 没人说话，只出旁白。
 */

export function resolveTurnTarget({ world, viewerId, say, present }) {
  const said = String(say || '');
  const actors = world?.actors || {};
  const here = (present || []).filter((a) => a && !a.dead && a.id !== viewerId);

  // ⓪ 点王甯的名：不管他在哪都应声
  const hus = actors.husband;
  if (hus && /(王甯|王掌柜|少掌柜)/.test(said)) {
    return { kind: 'husband', actorId: 'husband', named: true };
  }

  // ① 她点了谁的名（在场的才算）
  const named = here.find((a) => a.name && said.includes(a.name));
  if (named) return { kind: named.id === 'husband' ? 'husband' : 'npc', actorId: named.id, named: true };

  // ② 上次聊的是谁（且这个人在场）
  const partnerId = String((world?.chatPartners || {})[viewerId] || '');
  const partner = partnerId ? actors[partnerId] : null;
  const partnerHere = partner && !partner.dead && (present || []).some((a) => a && a.id === partnerId);
  if (partnerHere) return { kind: partnerId === 'husband' ? 'husband' : 'npc', actorId: partnerId, named: false };

  // ③ 她在对"你"说话——屋里没别人，那就是对王甯
  if (/(你|您)/.test(said) && here.length <= 1) {
    if (hus) return { kind: 'husband', actorId: 'husband', named: false };
  }

  return { kind: 'none', actorId: null, named: false };
}

/** 记下这一轮的对话对象 */
export function rememberPartner(world, viewerId, actorId) {
  world.chatPartners = world.chatPartners || {};
  if (actorId) world.chatPartners[viewerId] = actorId;
  return world;
}
