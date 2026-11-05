/**
 * 宅院生成器：一座宅子不是一个点，是一进一进的院子。
 *
 * 规矩：
 *   ① 宅有等第：小院（一进）/ 宅（三进）/ 大宅（五进）/ 府（七进）；
 *   ② 每个院子都给名字、给用处、给门路（与宅门互通，门通街）；
 *   ③ 下人按本分住进对应的房：丫鬟住下房、护院住倒座房、厨娘在庖厨、账房在账房；
 *   ④ 只生成一次（root.rooms 记着），以后只补不改。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 等第：由名字与规模推，不写死某个宅子 */
export function residenceGrade(name = '', scale = 0) {
  const s = String(name || '');
  // 契纸上写明的规模优先（"七进大宅"就是七进）
  if (scale >= 7) return 7;
  if (scale >= 5) return 5;
  if (scale >= 3) return 3;
  if (/府$|侯|伯|公府/.test(s)) return 7;
  if (/大宅|七进|巨宅/.test(s)) return 5;
  if (/宅|院|府/.test(s) && !/小院/.test(s)) return 3;
  if (scale >= 6) return 5;
  if (scale >= 3) return 3;
  return 1;
}

/** 各等第的院子：id 后缀、名字、用处 */
const LAYOUTS = {
  1: [
    { key: 'gate', name: '院门', use: 'gate' },
    { key: 'main', name: '正房', use: 'bedroom' },
    { key: 'wing', name: '厢房', use: 'bedroom' },
    { key: 'kitchen', name: '灶房', use: 'kitchen' },
  ],
  3: [
    { key: 'gate', name: '门厅', use: 'gate' },
    { key: 'front', name: '前院', use: 'yard' },
    { key: 'hall', name: '正厅', use: 'hall' },
    { key: 'main', name: '正房', use: 'bedroom' },
    { key: 'east', name: '东厢', use: 'bedroom' },
    { key: 'west', name: '西厢', use: 'bedroom' },
    { key: 'kitchen', name: '庖厨', use: 'kitchen' },
    { key: 'servant', name: '下房', use: 'servant' },
  ],
  5: [
    { key: 'gate', name: '门厅', use: 'gate' },
    { key: 'front', name: '前院', use: 'yard' },
    { key: 'reception', name: '前厅', use: 'hall' },
    { key: 'hall', name: '正厅', use: 'hall' },
    { key: 'study', name: '书房', use: 'study' },
    { key: 'account', name: '账房', use: 'office' },
    { key: 'main', name: '正房', use: 'bedroom' },
    { key: 'east', name: '东厢', use: 'bedroom' },
    { key: 'west', name: '西厢', use: 'bedroom' },
    { key: 'garden', name: '后院花园', use: 'garden' },
    { key: 'kitchen', name: '庖厨', use: 'kitchen' },
    { key: 'servant', name: '下房', use: 'servant' },
    { key: 'store', name: '库房', use: 'store' },
    { key: 'gatehouse', name: '倒座房', use: 'guard' },
    { key: 'stable', name: '马厩', use: 'stable' },
  ],
  7: [
    { key: 'gate', name: '门厅', use: 'gate' },
    { key: 'front', name: '前院', use: 'yard' },
    { key: 'sedan', name: '轿厅', use: 'hall' },
    { key: 'reception', name: '前厅', use: 'hall' },
    { key: 'hall', name: '正厅', use: 'hall' },
    { key: 'council', name: '议事厅', use: 'hall' },
    { key: 'study', name: '书房', use: 'study' },
    { key: 'account', name: '账房', use: 'office' },
    { key: 'main', name: '正房', use: 'bedroom' },
    { key: 'east', name: '东厢', use: 'bedroom' },
    { key: 'west', name: '西厢', use: 'bedroom' },
    { key: 'garden', name: '后院花园', use: 'garden' },
    { key: 'shrine', name: '祠堂', use: 'shrine' },
    { key: 'kitchen', name: '庖厨', use: 'kitchen' },
    { key: 'servant', name: '下房', use: 'servant' },
    { key: 'store', name: '库房', use: 'store' },
    { key: 'gatehouse', name: '倒座房', use: 'guard' },
    { key: 'stable', name: '马厩', use: 'stable' },
    { key: 'woodshed', name: '柴房', use: 'store' },
  ],
};

/** 下人按本分住哪 */
const STAFF_USE = [
  { test: /丫鬟|丫头|婢|通房/, use: 'servant' },
  { test: /护院|家丁|门房|护卫|小厮/, use: 'guard' },
  { test: /厨|灶/, use: 'kitchen' },
  { test: /账|掌柜|管事/, use: 'office' },
  { test: /马夫|车夫|轿夫/, use: 'stable' },
];

/** 这座宅子建过没有 */
function hasLayout(place) {
  return Boolean(place && place.rooms && Object.keys(place.rooms).length);
}

/**
 * 给一座宅子把院子建出来（幂等）
 * @returns {{built:boolean, rooms:number, grade:number}}
 */
export function ensureResidence(world, rootId, { scale = 0, ownerId = null } = {}) {
  const root = world?.places?.[rootId];
  if (!root) return { built: false, rooms: 0, grade: 0 };

  const gradeWanted = residenceGrade(root.name, scale);
  const grade = Math.max(num(root.grade), gradeWanted) || 3;

  // 宅名：取"临江·王宅"这一层
  const segs0 = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
  const houseName = segs0.length >= 3 ? `${segs0[0]}·${segs0[1]}` : (segs0.length === 2 ? `${segs0[0]}·${segs0[1]}` : (segs0[0] || '宅'));

  const relink = () => {
    root.exits = Array.isArray(root.exits) ? root.exits : [];
    for (const r of Object.values(root.rooms || {})) {
      const rp = world.places?.[r.id];
      if (!rp) continue;
      if (!rp.exits || !rp.exits.includes(rootId)) rp.exits = [rootId];
      if (!root.exits.includes(r.id)) root.exits.push(r.id);
      const want = `${houseName}·${r.name}`;
      if (rp.name !== want) rp.name = want;
    }
  };

  // 已有院子：等第够就只把门路与房名理顺
  if (hasLayout(root) && num(root.grade) >= grade) {
    relink();
    return { built: false, rooms: Object.keys(root.rooms).length, grade: num(root.grade) };
  }
  const spec = LAYOUTS[grade] || LAYOUTS[3];
  const baseName = houseName;
  root.rooms = root.rooms || {};
  root.grade = grade;
  root.residence = true;
  if (ownerId && !root.owner) root.owner = ownerId;

  let built = 0;
  for (const room of spec) {
    const pid = `${rootId}__${room.key}`;
    if (root.rooms[room.key] && world.places[root.rooms[room.key].id]) continue;
    if (world.places[pid]) { root.rooms[room.key] = { id: pid, name: room.name, use: room.use }; continue; }
    world.places[pid] = {
      id: pid,
      name: `${baseName}·${room.name}`,
      residence: true,
      use: room.use,
      parent: rootId,
      owner: root.owner || ownerId || null,
      exits: [rootId],
      dynamic: true,
    };
    root.rooms[room.key] = { id: pid, name: room.name, use: room.use };
    built += 1;
  }

  // 宅门通街，街也通宅门
  const street = world.places.street;
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  if (street) {
    if (!root.exits.includes('street')) root.exits.push('street');
    street.exits = Array.isArray(street.exits) ? street.exits : [];
    if (!street.exits.includes(rootId)) street.exits.push(rootId);
  }
  relink();

  return { built: built > 0, rooms: Object.keys(root.rooms).length, grade };
}

/**
 * 下人按本分住进各自的下房（只给有身份的，不凭空造人）
 * @returns {number} 安置人数
 */
export function assignStaffQuarters(world, rootId) {
  const root = world?.places?.[rootId];
  if (!root?.rooms) return 0;
  const byUse = {};
  const byKey = {};
  for (const [k, r] of Object.entries(root.rooms)) {
    byUse[r.use] = r.id;
    byKey[k] = r.id;
  }

  let placed = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    const livesHere = a.home === rootId
      || a.location === rootId
      || (a.home && world.places?.[a.home]?.parent === rootId)
      || (a.location && world.places?.[a.location]?.parent === rootId)
      || (root.owner === 'husband' && (a.household || a.spouse === 'husband'));
    if (!livesHere) continue;

    // 眷属按位份住：正妻住正房，二房住东厢，其余住西厢
    if (a.household || a.spouse === 'husband') {
      const rank = /正妻|大娘子/.test(String(a.role || '')) ? 'main'
        : /二房|如夫人|侧室|妾/.test(String(a.role || '')) ? 'east' : 'west';
      const room = byKey[rank] || byKey.main || byUse.bedroom;
      if (room && a.quarters !== room) { a.quarters = room; placed += 1; }
      continue;
    }

    const hit = STAFF_USE.find((s) => s.test.test(String(a.role || '')));
    if (!hit) continue;
    const room = byKey[hit.use] || byUse[hit.use] || byKey.servant || byUse.servant || byKey.gatehouse;
    if (!room) continue;
    if (a.quarters === room) continue;
    a.quarters = room;
    placed += 1;
  }
  return placed;
}

/**
 * 修院：账上记着某个院子，但世界里那个地点没了（或被清过）→ 补回来并连门路。
 */
export function repairRooms(world, rootId) {
  const root = world?.places?.[rootId];
  if (!root?.rooms) return 0;
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  let fixed = 0;
  for (const [key, r] of Object.entries(root.rooms)) {
    if (!r || !r.id) continue;
    if (!world.places[r.id]) {
      world.places[r.id] = {
        id: r.id, name: `${String(root.name || '宅').split('·').slice(0, 2).join('·')}·${r.name}`,
        residence: true, use: r.use, parent: rootId, owner: root.owner || null,
        exits: [rootId], dynamic: true,
      };
      fixed += 1;
    }
    if (!root.exits.includes(r.id)) root.exits.push(r.id);
  }
  return fixed;
}

/**
 * 宅门与各院互通（幂等）：老存档的宅子里已建了房间，但门路没连上，走不进去。
 */
/**
 * 只把门路与房名理顺（不建东西，每次读档都能跑，很便宜）
 */
export function relinkResidence(world, rootId) {
  const root = world?.places?.[rootId];
  if (!root?.rooms) return 0;
  const segs0 = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
  const houseName = segs0.length >= 2 ? `${segs0[0]}·${segs0[1]}` : (segs0[0] || '宅');
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  let linked = 0;
  for (const r of Object.values(root.rooms)) {
    const rp = world.places?.[r.id];
    if (!rp) continue;
    if (!rp.exits || !rp.exits.includes(rootId)) rp.exits = [rootId];
    if (!root.exits.includes(r.id)) { root.exits.push(r.id); linked += 1; }
    const want = `${houseName}·${r.name}`;
    if (rp.name !== want) rp.name = want;
  }
  return linked;
}

export function linkRooms(world, rootId) {
  const root = world?.places?.[rootId];
  if (!root?.rooms) return 0;
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  let linked = 0;
  for (const r of Object.values(root.rooms)) {
    const p = world.places?.[r.id];
    if (!p) continue;
    if (!p.exits || !p.exits.includes(rootId)) p.exits = [rootId];
    if (!root.exits.includes(r.id)) { root.exits.push(r.id); linked += 1; }
  }
  return linked;
}

/**
 * 巡检全世界的宅子：没院子的建院子，院子不够的补院子，再把下人安置好。
 * 每次读档都跑一遍（有院子的会立刻跳过，几乎不花钱），这样不会因为一次失败就永久缺院。
 */
/**
 * 清掉"房间里又长出来的房间"（id 里带两层 __），并把账上指向不存在地点的院子删掉。
 * 这是给一次事故擦屁股用的规则，不是特判：两层以上的一律不认。
 */
export function pruneRunawayRooms(world) {
  let removed = 0;
  for (const pid of Object.keys(world?.places || {})) {
    if ((String(pid).match(/__/g) || []).length >= 2) {
      delete world.places[pid];
      removed += 1;
    }
  }
  // 账上记着、世界里没有的院子，一并清掉
  for (const p of Object.values(world?.places || {})) {
    if (!p?.rooms) continue;
    for (const [k, r] of Object.entries(p.rooms)) {
      if (!r || !r.id || !world.places[r.id]) { delete p.rooms[k]; removed += 1; }
    }
  }
  return removed;
}

export function buildAllResidences(world) {
  let homes = 0;
  let rooms = 0;
  let upgraded = 0;
  pruneRunawayRooms(world);

  // 安全阀：地点已经多到不正常，就先不建了，免得把进程拖死
  if (Object.keys(world?.places || {}).length > 4000) {
    console.warn('[Residence] 地点过多，本轮跳过建院');
    return { homes: 0, rooms: 0, upgraded: 0 };
  }

  for (const [pid, p] of Object.entries(world?.places || {})) {
    try {
    if (!p) continue;
    // 院子本身不是宅子：有 parent 的都是某座宅子的房间，绝不再给它建院子
    if (p.parent) continue;
    if (String(pid).includes('__')) continue;
    const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);
    if (!looksHome) continue;
    if (!p.residence && /客栈|酒|茶|铺|坊|仓|衙|庙|观/.test(String(p.name || ''))) continue;

    const prop = (world.assets?.properties || []).find(
      (x) => x && (x.place === pid || (x.name && String(p.name || '').includes(String(x.name).split('（')[0]))),
    );
    const scale = prop && /七进/.test(String(prop.name || '')) ? 7 : prop && /大宅|五进/.test(String(prop.name || '')) ? 5 : 0;
    const before = p.rooms ? Object.keys(p.rooms).length : 0;
    const r = ensureResidence(world, pid, { scale, ownerId: prop?.owner || null });
    if (r.built) {
      homes += 1;
      rooms += r.rooms - before;
    }
    if (before && r.rooms > before) upgraded += 1;
    linkRooms(world, pid);
    repairRooms(world, pid);
    assignStaffQuarters(world, pid);
    } catch (e) {
      console.warn(`[Residence] ${pid} 建院失败：${e.message}`);
    }
  }
  return { homes, rooms, upgraded };
}
