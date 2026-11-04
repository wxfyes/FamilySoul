/**
 * 世界分层（realms）
 *
 * 世界不止一座临江城。凡尘、修仙、现代……可以并存，也可以互相进去。
 * 引擎不管"有没有神仙"，只管三件事：
 *   ① 每个地点属于哪一层（realm）
 *   ② 层与层之间从哪儿进（门户/秘境/梦）
 *   ③ 人现在在哪一层（由所在地点决定，不额外存字段，避免两处打架）
 *
 * 天道想开一层新的，就走 buildRealm 申报——和造地点一样，引擎验"能不能成立"。
 */

export const DEFAULT_REALM = 'mortal';

export function ensureRealms(world) {
  world.realms = world.realms || {};
  if (!world.realms[DEFAULT_REALM]) {
    world.realms[DEFAULT_REALM] = {
      id: DEFAULT_REALM,
      name: '凡尘',
      kind: 'mortal',
      desc: '有官府、有铺子、有生死，没有法术',
      openedDay: world.clock?.day || 1,
    };
  }
  // 老地点没有分层 → 归凡尘
  for (const pl of Object.values(world.places || {})) {
    if (pl && !pl.realm) pl.realm = DEFAULT_REALM;
  }
  return world.realms;
}

export function realmOf(world, placeId) {
  return world.places?.[placeId]?.realm || DEFAULT_REALM;
}

export function actorRealm(world, actorId) {
  const a = world.actors?.[actorId];
  if (!a?.location) return DEFAULT_REALM;
  return realmOf(world, a.location);
}

/** 同一层里的地点（给"去哪儿"用） */
export function placesInRealm(world, realmId) {
  return Object.entries(world.places || {}).filter(([, pl]) => pl && (pl.realm || DEFAULT_REALM) === realmId);
}

/** 可以跨层进出的门户 */
export function portals(world) {
  return Object.values(world.places || {}).filter((pl) => pl && pl.gate);
}

/**
 * 天道申报开一层新天地：[[realm:名字|门在哪个地点]]
 * 引擎验：名字像样、门存在、不重名、不超量。
 */
export function buildRealm(world, { name, gatePlaceId, kind = 'other' }) {
  ensureRealms(world);
  const nm = String(name || '').replace(/\s/g, '');
  if (!/^[\u4e00-\u9fa5]{2,8}$/.test(nm)) return { ok: false, error: '名字不像一层天地' };
  if (Object.values(world.realms).some((r) => r?.name === nm)) return { ok: false, error: '这一层已经有了' };
  if (Object.keys(world.realms).length >= 6) return { ok: false, error: '天地已多，暂不能再开' };
  if (!world.places?.[gatePlaceId]) return { ok: false, error: '门户不存在' };

  const id = `realm_${Object.keys(world.realms).length + 1}`;
  world.realms[id] = {
    id,
    name: nm,
    kind,
    desc: '',
    gate: gatePlaceId,
    openedDay: world.clock?.day || 1,
  };
  // 门户本身打上标记，双向可走由地点 exits 承担
  world.places[gatePlaceId].gate = world.places[gatePlaceId].gate || id;
  return { ok: true, realm: world.realms[id] };
}

/** 把某处归到某一层（天道设新天地时，顺手把新地点挂进去） */
export function assignRealm(world, placeId, realmId) {
  ensureRealms(world);
  if (!world.places?.[placeId] || !world.realms?.[realmId]) return false;
  world.places[placeId].realm = realmId;
  return true;
}
