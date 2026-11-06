import io
p = 'src/world/marriage.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function maybeOfferAlliance' not in s:
    s += '''

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
export function maybeOfferAlliance(world, playerId = 'husband') {
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
  if (Math.random() > 0.45) return null;

  const girls = Object.values(world?.actors || {}).filter((a) => a && !a.dead
    && /小姐|才女/.test(String(a.role || '')) && isMarriageable(world, a)
    && cityOf(world, a) === city);
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
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加主动联姻')
