/**
 * 道统：名分与清议。
 *
 * 只有一件事是真的：一个人在外面是什么名声，会影响别人怎么对他。
 *   · 仁商：施粥赈灾、平价粜米
 *   · 义士：护人、还债、守诺
 *   · 权臣：掌权、结党
 *   · 乱贼：背盟、杀人、劫掠
 *
 * 名声不改战力，但会改：别人对你的关系、能不能称制、士林怎么说你。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const TAGS = ['仁商', '义士', '权臣', '乱贼'];

export function ensureFame(world) {
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    if (!a.fame || typeof a.fame !== 'object') a.fame = { value: 0, tags: [] };
    if (!Array.isArray(a.fame.tags)) a.fame.tags = [];
    a.fame.value = Math.max(-100, Math.min(100, num(a.fame.value)));
  }
  return world;
}

export function fameOf(world, actorId) {
  return num(world.actors?.[actorId]?.fame?.value);
}

/** 加/减名声，并自动贴标签 */
export function addFame(world, actorId, delta, tag) {
  ensureFame(world);
  const a = world.actors?.[actorId];
  if (!a) return 0;
  a.fame.value = Math.max(-100, Math.min(100, num(a.fame.value) + num(delta)));
  if (tag && TAGS.includes(tag)) {
    // 名声足够高/低才贴标签，避免一出场就是"乱贼"
    const v = a.fame.value;
    if ((tag === '乱贼' && v <= -30) || (tag !== '乱贼' && v >= 30)) {
      if (!a.fame.tags.includes(tag)) a.fame.tags.push(tag);
    }
  }
  return a.fame.value;
}

/** 名分：能不能称制（看名声与城数） */
export function legitimacy(world, actorId) {
  const fame = fameOf(world, actorId);
  const cities = (world.factions?.wangjia?.cities || []).length;
  const base = Math.round(fame / 2) + cities * 5;
  return Math.max(0, Math.min(100, base + 20));
}

/** 每月初：士林清议（只说事实，不写台词） */
export function runGentlemenTalk(world, events, nextEvent) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return;
  ensureFame(world);
  const top = Object.values(world.actors || {})
    .filter((a) => a && !a.dead && a.fame && Math.abs(num(a.fame.value)) >= 40)
    .sort((a, b) => Math.abs(num(b.fame.value)) - Math.abs(num(a.fame.value)))
    .slice(0, 2);
  for (const a of top) {
    const good = num(a.fame.value) > 0;
    events.push(nextEvent(world, {
      action: 'gentry_talk', actor: a.id, place: a.location || null,
      payload: { text: good ? `士林称道${a.name}的仁义` : `市井议论${a.name}的所作所为` },
      isPublic: true,
    }));
  }
}
