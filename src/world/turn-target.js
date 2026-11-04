import { findTargetActorInText } from './naming.js';

/**
 * 这一轮该谁说话：唯一的发言权判定处。
 * 优先级：相公指名呼唤在场者 > 现场唯一在场活人 > 上次在场对话者 > 场景首位在场女性/掌事人。
 */
export function resolveTurnTarget({ world, viewerId = 'husband', say = '', present = [] }) {
  const said = String(say || '');
  const actors = world?.actors || {};
  const here = (present || []).filter((a) => a && !a.dead && a.id !== viewerId);

  // ⓪ 点王甯的名：不管他在哪都应声
  const hus = actors.husband;
  if (hus && /(王甯|王掌柜|少掌柜)/.test(said)) {
    return { kind: 'husband', actor: hus, actorId: 'husband', named: true };
  }

  // ① 相公指名道姓/古风称呼呼唤（如"杨娘子"、"静儿"、"婉儿"）
  const named = findTargetActorInText(actors, said);
  if (named) {
    const isHere = here.some((a) => a.id === named.id);
    if (isHere) {
      return { kind: named.id === 'husband' ? 'husband' : 'npc', actor: named, actorId: named.id, named: true };
    }
  }

  // ② 现场唯一直属在场者：除相公外只有1人在场，唯一正主就是她！
  if (here.length === 1) {
    return { kind: 'npc', actor: here[0], actorId: here[0].id, named: false, solePresent: true };
  }

  // ③ 上次聊的是谁（且这个人在场且未离场）
  const partnerId = String((world?.chatPartners || {})[viewerId] || '');
  const partner = partnerId ? actors[partnerId] : null;
  const partnerHere = partner && !partner.dead && here.some((a) => a.id === partnerId);
  if (partnerHere) {
    return { kind: partnerId === 'husband' ? 'husband' : 'npc', actor: partner, actorId: partnerId, named: false };
  }

  // ④ 默认场景首位女性/掌事正主
  if (here.length > 0) {
    const prime = here.find((a) => a.gender === 'female') || here[0];
    return { kind: 'npc', actor: prime, actorId: prime.id, named: false };
  }

  return { kind: 'none', actor: null, actorId: null, named: false };
}

/** 记下这一轮的对话对象 */
export function rememberPartner(world, viewerId, actorId) {
  world.chatPartners = world.chatPartners || {};
  if (actorId) world.chatPartners[viewerId] = actorId;
  return world;
}
