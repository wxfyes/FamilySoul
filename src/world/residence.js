/**
 * 宅院生成器：一座宅子不是一个点，是一进一进的院子。
 *
 * 规矩：
 *   ① 宅有等第：小院（一进）/ 宅（三进）/ 大宅（五进）/ 府（七进）；
 *   ② 每个院子都给名字、给用处、给门路（与宅门互通，门通街）；
 *   ③ 下人按本分住进对应的房：丫鬟住下房、护院住倒座房、厨娘在庖厨、账房在账房；
 *   ④ 只生成一次（root.rooms 记着），以后只补不改。
 */

import { moveActor } from './position.js';

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
    { key: 'gate', name: '院门', use: 'gate', depth: 1, access: 'public_outer' },
    { key: 'main', name: '正房', use: 'bedroom', depth: 2, access: 'family_core' },
    { key: 'wing', name: '厢房', use: 'bedroom', depth: 2, access: 'family_inner' },
    { key: 'kitchen', name: '灶房', use: 'kitchen', depth: 3, access: 'servant_utility' },
  ],
  3: [
    { key: 'gate', name: '门厅', use: 'gate', depth: 1, access: 'public_outer' },
    { key: 'front', name: '前院', use: 'yard', depth: 1, access: 'public_outer' },
    { key: 'hall', name: '正厅', use: 'hall', depth: 2, access: 'guest_main' },
    { key: 'main', name: '正房', use: 'bedroom', depth: 3, access: 'family_core' },
    { key: 'east', name: '东厢', use: 'bedroom', depth: 3, access: 'family_inner' },
    { key: 'west', name: '西厢', use: 'bedroom', depth: 3, access: 'family_inner' },
    { key: 'kitchen', name: '庖厨', use: 'kitchen', depth: 3, access: 'servant_utility' },
    { key: 'servant', name: '下房', use: 'servant', depth: 3, access: 'servant_utility' },
  ],
  5: [
    { key: 'gate', name: '门厅', use: 'gate', depth: 1, access: 'public_outer' },
    { key: 'front', name: '前院', use: 'yard', depth: 1, access: 'public_outer' },
    { key: 'sedan', name: '轿厅', use: 'hall', depth: 2, access: 'guest_outer' },
    { key: 'hall', name: '正厅', use: 'hall', depth: 3, access: 'guest_main' },
    { key: 'study', name: '书房', use: 'study', depth: 3, access: 'family_inner' },
    { key: 'account', name: '账房', use: 'office', depth: 3, access: 'guest_main' },
    { key: 'main', name: '正房', use: 'bedroom', depth: 4, access: 'family_core' },
    { key: 'east', name: '东厢', use: 'bedroom', depth: 5, access: 'family_inner' },
    { key: 'west', name: '西厢', use: 'bedroom', depth: 5, access: 'family_inner' },
    { key: 'garden', name: '后院花园', use: 'garden', depth: 6, access: 'family_private' },
    { key: 'kitchen', name: '庖厨', use: 'kitchen', depth: 7, access: 'servant_utility' },
    { key: 'servant', name: '下房', use: 'servant', depth: 7, access: 'servant_utility' },
    { key: 'store', name: '库房', use: 'store', depth: 7, access: 'servant_utility' },
    { key: 'gatehouse', name: '倒座房', use: 'guard', depth: 1, access: 'public_outer' },
    { key: 'stable', name: '马厩', use: 'stable', depth: 1, access: 'public_outer' },
  ],
  // 七进豪门：按《营造》规制定死七进，深度与开门权限一并写清，绝不递归生长
  7: [
    { key: 'gate', name: '朱漆大门', use: 'gate', depth: 1, access: 'public_outer' },
    { key: 'front', name: '门头外院', use: 'yard', depth: 1, access: 'public_outer' },
    { key: 'gatehouse', name: '门房倒座', use: 'guard', depth: 1, access: 'public_outer' },
    { key: 'stable', name: '车舆马厩', use: 'stable', depth: 1, access: 'public_outer' },
    { key: 'sedan', name: '仪门轿厅', use: 'hall', depth: 2, access: 'guest_outer' },
    { key: 'reception', name: '迎客小厅', use: 'hall', depth: 2, access: 'guest_outer' },
    { key: 'hall', name: '中堂大厅', use: 'hall', depth: 3, access: 'guest_main' },
    { key: 'council', name: '议事厅', use: 'hall', depth: 3, access: 'guest_main' },
    { key: 'account', name: '账房', use: 'office', depth: 3, access: 'guest_main' },
    { key: 'study', name: '书房', use: 'study', depth: 3, access: 'family_inner' },
    { key: 'main', name: '正房暖阁', use: 'bedroom', depth: 4, access: 'family_core' },
    { key: 'east', name: '东厢房', use: 'bedroom', depth: 5, access: 'family_inner' },
    { key: 'west', name: '西厢房', use: 'bedroom', depth: 5, access: 'family_inner' },
    { key: 'garden', name: '临波后花园', use: 'garden', depth: 6, access: 'family_private' },
    { key: 'shrine', name: '祠堂', use: 'shrine', depth: 6, access: 'family_private' },
    { key: 'servant', name: '后罩房', use: 'servant', depth: 7, access: 'servant_utility' },
    { key: 'kitchen', name: '大庖厨', use: 'kitchen', depth: 7, access: 'servant_utility' },
    { key: 'store', name: '库房', use: 'store', depth: 7, access: 'servant_utility' },
    { key: 'woodshed', name: '柴房', use: 'store', depth: 7, access: 'servant_utility' },
    { key: 'barracks', name: '私兵值房', use: 'guard', depth: 7, access: 'servant_utility' },
  ],
};

/** 经营场所的立体空间：前店后坊、三层酒楼带地窖——同样定死，不递归 */
const PREMISES = {
  restaurant: [
    { key: 'f1', name: '一层大堂', use: 'shop_floor', floor: 1, access: 'public_shop' },
    { key: 'f2', name: '二层雅阁', use: 'shop_floor', floor: 2, access: 'public_shop' },
    { key: 'f3', name: '三层天字阁', use: 'shop_floor', floor: 3, access: 'public_shop' },
    { key: 'kitchen', name: '后厨', use: 'kitchen', floor: 0, access: 'servant_utility' },
    { key: 'cellar', name: '后院酒窖', use: 'store', floor: -1, access: 'servant_utility' },
  ],
  teahouse: [
    { key: 'front', name: '临街茶堂', use: 'shop_floor', floor: 1 },
    { key: 'back', name: '后坊焙茶', use: 'workshop', floor: 0 },
    { key: 'room', name: '雅间', use: 'shop_floor', floor: 2 },
  ],
  tavern: [
    { key: 'front', name: '前堂酒座', use: 'shop_floor', floor: 1 },
    { key: 'room', name: '后堂雅间', use: 'shop_floor', floor: 0 },
    { key: 'kitchen', name: '后厨', use: 'kitchen', floor: 0 },
  ],
  shop: [
    { key: 'front', name: '前店柜台', use: 'shop_floor', floor: 1 },
    { key: 'back', name: '后坊库房', use: 'workshop', floor: 0 },
  ],
  brothel: [
    { key: 'hall', name: '一层歌台大厅', use: 'shop_floor', floor: 1, access: 'public_shop' },
    { key: 'yajian', name: '二层温香雅阁', use: 'private_room', floor: 2, access: 'private' },
    { key: 'inner', name: '后院内室', use: 'bedroom', floor: 1, access: 'family_private' },
  ],
};

/** 官府衙署：也是定死的层级，不递归 */
const COURT = [
  { key: 'gate', name: '照壁牌楼', use: 'gate', depth: 1, access: 'public_outer' },
  { key: 'hall', name: '大堂公堂', use: 'hall', depth: 2, access: 'guest_main' },
  { key: 'office', name: '二堂签押', use: 'office', depth: 3, access: 'family_inner' },
  { key: 'inner', name: '内宅花厅', use: 'bedroom', depth: 4, access: 'family_private' },
  { key: 'jail', name: '大牢', use: 'jail', depth: 0, access: 'servant_utility' },
  { key: 'ground', name: '演武校场', use: 'yard', depth: 1, access: 'public_outer' },
];

/** 按名字判经营场所类型 */
function premisesKind(name = '') {
  const s = String(name || '');
  // 三层/大酒楼才是三层楼；街边酒肆只有前堂、后堂与后厨
  if (/三层|大酒楼|码头.*酒楼/.test(s)) return 'restaurant';
  if (/酒肆|酒馆|小酒馆/.test(s)) return 'tavern';
  if (/酒楼|饭庄/.test(s)) return 'restaurant';
  if (/茶坊|茶肆|茶楼|茶铺/.test(s)) return 'teahouse';
  if (/万花楼|青楼|勾栏|妓馆|花楼/.test(s)) return 'brothel';
  if (/铺|坊|行|栈|号|店/.test(s)) return 'shop';
  return null;
}


/** 挑担走街的流动人口：卖花、货郎、挑夫、轿夫、游侠……他们不该寄居在别人民宅 */
const ITINERANT = /卖花|货郎|挑夫|轿夫|行商|客商|游侠|乞儿|流民|脚夫|走街|串巷/;

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
 * 一间院子不是一座宅子。
 * 老存档里，展开放出来的院子被标成了 residence:true，巡检便把它当宅根，
 * 又给它建出一整套七进院落（西厢房里再长出一座王府），人越住越乱。
 * 规矩：凡是自成一宅的"房间"，一律降回房间，绝不再递归建院。
 */
export function demoteNestedMansions(world) {
  const demoted = [];
  const places = world?.places || {};
  const houseNameOf = (p) => {
    const segs = String(p?.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
    return segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '宅');
  };

  // 谁的账上点了谁（按 id 的强引用）：被点得多的排在后面，先让真宅根动手
  const claimed = new Map();
  for (const root of Object.values(places)) {
    if (!root?.rooms) continue;
    for (const rec of Object.values(root.rooms)) {
      if (rec?.id && places[rec.id]) claimed.set(rec.id, (claimed.get(rec.id) || 0) + 1);
    }
  }
  const priority = (id) => (id === 'husband_room' ? -1 : 0);   // 王宅正房是既定的宅根
  const roots = Object.entries(places)
    .filter(([, p]) => p && p.rooms && !p.isRoom && !p.parent)
    .sort((a, b) => (priority(a[0]) - priority(b[0])) || ((claimed.get(a[0]) || 0) - (claimed.get(b[0]) || 0)));

  const demoteOne = (room, rootId, rec) => {
    if (!room || String(room.id) === String(rootId)) return;
    room.isRoom = true;
    room.residence = false;
    if (room.parent !== rootId) room.parent = rootId;
    const root = places[rootId];
    root.exits = Array.isArray(root.exits) ? root.exits : [];
    if (!root.exits.includes(room.id)) root.exits.push(room.id);
    const n = Object.keys(room.rooms || {}).length;
    if (n < 4) return;                     // 只是零星补过账，不必大动
    // 这间房长出过自己的宅子：拆掉它，把住在里头的人送回本房
    for (const sub of Object.values(room.rooms || {})) {
      if (!sub?.id) continue;
      if (places[sub.id]) delete places[sub.id];
      for (const a of Object.values(world?.actors || {})) {
        if (!a) continue;
        if (a.location === sub.id) a.location = room.id;
        if (a.home === sub.id) a.home = room.id;
        if (a.quarters === sub.id) delete a.quarters;
      }
    }
    for (const a of Object.values(world?.actors || {})) {
      if (!a) continue;
      if (a.quarters && String(a.quarters).startsWith(`${room.id}__`)) delete a.quarters;
      if (a.duty && String(a.duty.home) === String(room.id)) delete a.duty;
    }
    delete room.rooms;
    delete room.grade;
    delete room.owner;
    room.use = (rec && rec.use) || room.use || 'bedroom';
    room.depth = (rec && rec.depth) || null;
    room.access = (rec && rec.access) || 'family_inner';
    room.exits = [rootId];
    demoted.push(`${room.name || room.id}（原 ${n} 间账）`);
  };

  for (const [rootId, root] of roots) {
    if (!root.rooms) continue;
    if (root.isRoom || root.parent) continue;   // 已被前面的宅子认作房间，不再当宅根
    const houseName = houseNameOf(root);
    const used = new Set();
    for (const rec of Object.values(root.rooms)) {
      if (!rec || !rec.name) continue;
      let room = rec.id ? places[rec.id] : null;
      // 老存档：账上写的是 husband_room__west，真正的院子却叫 wang_mansion_west —— 按宅名·房名认回来
      if (!room) {
        const want = `${houseName}·${rec.name}`;
        const hits = Object.entries(places).filter(([id, p]) => id !== rootId && p && p.name === want);
        if (hits.length === 1) {
          rec.id = hits[0][0];
          room = hits[0][1];
        }
      }
      if (room) { used.add(room.id); demoteOne(room, rootId, rec); }
    }
    // 账上房名与地点名对不上（东厢房 vs 东跨院）：同一宅名下、就走门的另一头，也是这宅的房间
    for (const exId of Array.isArray(root.exits) ? root.exits : []) {
      if (used.has(exId) || exId === 'husband_room') continue;
      const ex = places[exId];
      if (!ex || !ex.rooms || ex.id === rootId) continue;
      if (!String(ex.name || '').startsWith(`${houseName}·`)) continue;
      demoteOne(ex, rootId, null);
    }
  }
  return demoted;
}

/**
 * 同宅名下的院落，一律挂回宅根名下（幂等，每次巡检都跑）。
 * 老存档里展开放出来的院子与宅根脱了钩，成了同名"野地点"——门能从宅子里走过去，
 * 但 parent 空着，homeOf/门禁/房间账全认不出它，越住越乱。
 */
export function linkSameHouseRooms(world) {
  let linked = 0;
  for (const [rootId, root] of Object.entries(world?.places || {})) {
    if (!root?.rooms || root.isRoom || root.parent) continue;
    const segs = String(root.name || '').split('·').map((x) => x.trim()).filter(Boolean);
    const houseName = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : '';
    if (!houseName) continue;
    root.exits = Array.isArray(root.exits) ? root.exits : [];
    for (const exId of root.exits) {
      const ex = world.places?.[exId];
      if (!ex || exId === rootId || ex.parent) continue;
      if (!String(ex.name || '').startsWith(`${houseName}·`)) continue;
      ex.parent = rootId;
      ex.isRoom = true;
      ex.residence = false;
      if (!ex.use) ex.use = 'bedroom';
      if (!ex.access) ex.access = 'family_inner';
      linked += 1;
    }
  }
  return linked;
}

/**
 * 给一座宅子把院子建出来（幂等）
 * @returns {{built:boolean, rooms:number, grade:number}}
 */
export function ensureResidence(world, rootId, { scale = 0, ownerId = null } = {}) {
  const root = world?.places?.[rootId];
  if (!root) return { built: false, rooms: 0, grade: 0 };
  // 房间不自成一宅：有父宅的、或被明确标成房间的，绝不再建院子（防"西厢房里再长一座王府"）
  if (root.isRoom || root.parent) return { built: false, rooms: 0, grade: 0 };

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
  const specLen = (LAYOUTS[grade] || LAYOUTS[3]).length;
  const haveRooms = Object.keys(root.rooms || {}).length;
  // 房间账残缺（被清过）也要按等第补齐，不能因为"有个门"就算有院子
  if (hasLayout(root) && num(root.grade) >= grade && haveRooms >= specLen) {
    relink();
    return { built: false, rooms: haveRooms, grade: num(root.grade) };
  }
  const spec = LAYOUTS[grade] || LAYOUTS[3];
  const baseName = houseName;
  root.rooms = root.rooms || {};
  root.grade = grade;
  root.residence = true;
  if (grade >= 3) { root.depth = 4; root.access = 'family_core'; }
  if (ownerId && !root.owner) root.owner = ownerId;

  // 只写"账"（这宅子有几间什么院），不写"地点"——地点等人真走进去时再展开
  let built = 0;
  for (const room of spec) {
    const pid = `${rootId}__${room.key}`;
    if (!root.rooms[room.key]) built += 1;
    root.rooms[room.key] = {
      id: pid, name: room.name, use: room.use,
      depth: room.depth || null, access: room.access || null, floor: room.floor || null,
    };
  }

  // 宅门通街，街也通宅门（只连宅门，不连房间）
  const street = world.places.street;
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  if (street) {
    if (!root.exits.includes('street')) root.exits.push('street');
    street.exits = Array.isArray(street.exits) ? street.exits : [];
    if (!street.exits.includes(rootId)) street.exits.push(rootId);
  }

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
    if (ITINERANT.test(String(a.role || ''))) continue;   // 流动小贩不占宅子
    const livesHere = a.home === rootId
      || a.location === rootId
      || (a.home && world.places?.[a.home]?.parent === rootId)
      || (a.location && world.places?.[a.location]?.parent === rootId)
      || (root.owner === 'husband' && (a.household || a.spouse === 'husband'));
    if (!livesHere) continue;

    // 眷属按位份住：正妻与平妻并嫡住正房，二房/侧室住东西跨院/东厢/西厢
    if (a.household || a.spouse === 'husband') {
      // 铁律：若相公已明确钦定居所，最高优先级尊重，绝不随意覆盖！
      if (a.assignedRoom && (byKey[a.assignedRoom] || world.places?.[a.assignedRoom] || Object.values(byKey).includes(a.assignedRoom))) {
        continue;
      }
      const isPrincipal = /正妻|大娘子|平妻|并嫡/.test(String(a.role || '')) || /正室|平妻/.test(String(a.status || ''));
      const isConcubine = /二房|如夫人|侧室|妾/.test(String(a.role || '')) || /侧室|妾室/.test(String(a.status || ''));
      const rank = isPrincipal ? 'main' : isConcubine ? 'east' : 'west';
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
        residence: false, isRoom: true, use: r.use, parent: rootId,
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
/**
 * 把旧存档的院子升到当前模板：补缺的房间、补 depth/access、按模板改名。
 * 只补不删，幂等。
 */
export function upgradeResidence(world, rootId) {
  const root = world?.places?.[rootId];
  if (!root?.rooms || root.parent || String(rootId).includes('__')) return 0;
  const name = String(root.name || '');
  if (/·(东厢房|西厢房|东跨院|西跨院|正房|后院|庖厨|灶房|下房|门厅|倒座|马厩|柴房|祠堂|书房|账房|私兵值房)$/.test(name)) return 0;
  if (premisesKind(name) || /衙|县衙|府衙|公堂|牢|摊|铺|坊|行|栈|号|店|楼|肆|院$|仓|庙|观|寺|学|校场|码头/.test(name)) {
    if (!root.residence) return 0;
  }
  const grade = num(root.grade) || residenceGrade(root.name, 0);
  const spec = LAYOUTS[grade] || LAYOUTS[3];
  const segs = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
  const houseName = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '宅');
  let changed = 0;
  for (const room of spec) {
    const existing = root.rooms[room.key];
    const pid = existing?.id || `${rootId}__${room.key}`;
    // 只改账；已经展开的地点顺手把名字与进深对齐
    const rp = world.places?.[pid];
    if (rp) {
      const want = `${houseName}·${room.name}`;
      if (rp.name !== want) { rp.name = want; changed += 1; }
      if (room.depth && rp.depth !== room.depth) { rp.depth = room.depth; changed += 1; }
      if (room.access && rp.access !== room.access) { rp.access = room.access; changed += 1; }
    }
    const wantRec = { id: pid, name: room.name, use: room.use, depth: room.depth || null, access: room.access || null };
    if (!existing || existing.name !== wantRec.name || existing.depth !== wantRec.depth) changed += 1;
    root.rooms[room.key] = wantRec;
  }
  if (grade >= 3 && (root.depth !== 4 || root.access !== 'family_core')) {
    root.depth = 4; root.access = 'family_core'; changed += 1;
  }
  relinkResidence(world, rootId);
  return changed;
}

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

/**
 * 按需把一间院子展开成真实地点（只在这里创建 place）
 * @returns {string|null} 房间的 placeId
 */
export function materializeRoom(world, parentId, key) {
  const root = world?.places?.[parentId];
  const rec = root?.rooms?.[key];
  if (!root || !rec) return null;
  const id = rec.id || `${parentId}__${key}`;
  let p = world.places[id];
  if (!p) {
    const segs = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
    const houseName = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '宅');
    world.places[id] = {
      id,
      name: `${houseName}·${rec.name}`,
      residence: false,
      isRoom: true,
      use: rec.use || null,
      parent: parentId,
      owner: root.owner || null,
      exits: [parentId],
      depth: rec.depth || null,
      access: rec.access || null,
      floor: rec.floor || null,
      dynamic: true,
    };
    p = world.places[id];
  }
  // 双向门路
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  if (!root.exits.includes(id)) root.exits.push(id);
  if (!p.exits || !p.exits.includes(parentId)) p.exits = [parentId];
  return id;
}

/** 老存档：把已经建成"独立地点"的房间收回到父地点的账里（只留人待着的那几间） */
export function collapseRoomPlaces(world) {
  let removed = 0;
  const occupied = new Set(Object.values(world.actors || {}).map((a) => a && a.location).filter(Boolean));
  for (const [pid, p] of Object.entries(world?.places || {})) {
    if (!p || !p.parent) continue;
    const parent = world.places[p.parent];
    if (!parent) { delete world.places[pid]; removed += 1; continue; }
    parent.rooms = parent.rooms || {};
    const key = String(pid).split('__').pop();
    if (!parent.rooms[key]) {
      parent.rooms[key] = { id: pid, name: String(p.name || '').split('·').pop(), use: p.use || null, depth: p.depth || null, access: p.access || null, floor: p.floor || null };
    }
    // 有人待着的房间先留着，等他自己走开再收
    if (occupied.has(pid)) continue;
    parent.exits = (parent.exits || []).filter((x) => x !== pid);
    delete world.places[pid];
    removed += 1;
  }
  return removed;
}

export function buildAllResidences(world) {
  let homes = 0;
  let rooms = 0;
  let upgraded = 0;
  pruneRunawayRooms(world);
  pruneForeignRooms(world);

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
    // 商业与衙署有自己的模板，宅院不要插手
    if (premisesKind(p.name) || /衙|仓|庙|观|寺|学|院$/.test(String(p.name || ''))) continue;
    const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);
    if (!looksHome) continue;
    if (!p.residence && /客栈|酒|茶|铺|坊|仓|衙|庙|观/.test(String(p.name || ''))) continue;

    const prop = (world.assets?.properties || []).find(
      (x) => x && (x.placeId === pid || x.place === pid || x.id === pid),
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

/**
 * 流动小贩归位：卖花女、货郎、挑夫这些不该住在别人家里。
 * 只动人，不动房；每天巡检一次。
 */
export function settleItinerants(world) {
  let moved = 0;
  const street = world?.places?.street ? 'street' : null;
  for (const a of Object.values(world?.actors || {})) {
    if (!a || a.dead) continue;
    if (!ITINERANT.test(String(a.role || ''))) continue;
    const home = world.places?.[a.home];
    const squatting = home && home.residence && home.owner && home.owner !== a.id;
    if (!squatting && a.location !== a.home) continue;
    if (home && home.owner === a.id) continue;
    if (!street) continue;
    a.home = street;
    if (world.places?.[a.location]?.residence) a.location = street;
    delete a.quarters;
    moved += 1;
  }
  return moved;
}

/**
 * 经营场所的立体空间（幂等）：三层酒楼、前店后坊、茶坊雅间。
 * 与宅院同一套规矩：定死模板、双向开门、只建一次。
 */
export function buildPremises(world) {
  let built = 0;
  const places = world?.places || {};
  if (Object.keys(places).length > 4000) return 0;
  for (const [pid, p] of Object.entries(places)) {
    if (!p || p.parent || String(pid).includes('__')) continue;
    const kind = premisesKind(p.name);
    if (!kind) continue;
    // 街边酒肆不是三层酒楼：清掉历史误建的二层/三层，并把楼上的人请回前堂
    if (kind === 'tavern' && p.rooms) {
      const baseName = String(p.name || '酒肆').split('·').slice(0, 2).join('·');
      for (const key of ['f2', 'f3']) {
        const rec = p.rooms[key];
        if (!rec) continue;
        const rid = rec.id;
        if (rid) {
          for (const a of Object.values(world.actors || {})) {
            if (a && a.location === rid) {
              try { moveActor(world, a.id, pid, 'world', '酒肆不是三层楼'); } catch { /* 忽略 */ }
            }
          }
          if (world.places?.[rid]) delete world.places[rid];
        }
        delete p.rooms[key];
      }
      if (p.rooms.f1) {
        p.rooms.f1.name = '前堂酒座';
        const rp = world.places?.[p.rooms.f1.id];
        if (rp) rp.name = `${baseName}·前堂酒座`;
      }
    }
    if (p.rooms && Object.keys(p.rooms).length) continue;
    // 已有房间也要进来（补缺 + 改名），不能直接跳过
    // 有名有姓的铺子都给它把前店后坊补上（野摊不建）

    const spec = PREMISES[kind];
    p.rooms = p.rooms || {};
    p.exits = Array.isArray(p.exits) ? p.exits : ['street'];
    const segs = String(p.name || '铺').split('·').map((x) => x.trim()).filter(Boolean);
    const base = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '铺');
    for (const room of spec) {
      const rid = `${pid}__${room.key}`;
      if (!p.rooms[room.key]) built += 1;
      // 前堂/雅阁可待客，后厨、库房、后坊、酒窖是当差的地方，外人止步
      const publicUse = room.use === 'shop_floor' || room.use === 'hall';
      p.rooms[room.key] = {
        id: rid, name: room.name, use: room.use, floor: room.floor,
        access: publicUse ? 'public_shop' : 'staff_only',
      };
    }
    // 收尾：按模板把名字与楼层纠正（老存档里可能叫"灶房""院门"）
    for (const room of spec) {
      const rec = p.rooms[room.key];
      const rp = rec && places[rec.id];
      if (!rp) continue;
      rec.name = room.name;
      rec.use = room.use;
      rec.floor = room.floor;
      rp.name = `${base}·${room.name}`;
      rp.use = room.use;
      rp.floor = room.floor;
    }
  }
  return built;
}

/**
 * 官府衙署层级（幂等）：照壁牌楼、大堂、二堂签押、内宅花厅、大牢、校场。
 */
export function buildCourts(world) {
  let built = 0;
  const places = world?.places || {};
  if (Object.keys(places).length > 4000) return 0;
  for (const [pid, p] of Object.entries(places)) {
    if (!p || p.parent || String(pid).includes('__')) continue;
    const name = String(p.name || '');
    if (/摊|牢|客栈|铺|坊|仓|庙|观/.test(name)) continue;
    if (!/衙|县衙|府衙|公堂/.test(name)) continue;
    p.rooms = p.rooms || {};
    p.exits = Array.isArray(p.exits) ? p.exits : ['street'];
    const segs = String(p.name || '衙').split('·').map((x) => x.trim()).filter(Boolean);
    const base = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '衙');
    for (const room of COURT) {
      const rid = `${pid}__${room.key}`;
      if (!p.rooms[room.key]) built += 1;
      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, depth: room.depth, access: room.access };
    }
    for (const room of COURT) {
      const rec = p.rooms[room.key];
      const rp = rec && places[rec.id];
      if (!rp) continue;
      rec.name = room.name;
      rp.name = `${base}·${room.name}`;
      rp.use = room.use;
      rp.depth = room.depth;
      rp.access = room.access;
    }
  }
  return built;
}

/**
 * 清掉"串了模板"的房间：酒楼里不该有正房，衙署里不该有灶房。
 * @returns {number} 清掉的房间数
 */
export function pruneForeignRooms(world) {
  let removed = 0;
  for (const [pid, p] of Object.entries(world?.places || {})) {
    if (!p || !p.rooms || p.parent) continue;
    const name = String(p.name || '');
    // 商业/衙署优先按自己的模板清（哪怕它曾被误标成住宅）
    let allowed = null;
    const kind = premisesKind(name);
    if (kind) allowed = new Set(PREMISES[kind].map((r) => r.key));
    else if (/衙|县衙|府衙|公堂/.test(name)) allowed = new Set(COURT.map((r) => r.key));
    if (!allowed) continue;
    for (const [key, r] of Object.entries(p.rooms)) {
      if (allowed.has(key)) continue;
      if (r?.id && world.places[r.id]) delete world.places[r.id];
      delete p.rooms[key];
      removed += 1;
    }
  }
  return removed;
}

/** 清掉"不归相公管"的城的衙署内部（早先按全国建的那一批） */
export function pruneRemoteCourts(world) {
  const myCities = new Set(['临江府', '京城']);
  for (const pr of (world.assets?.properties || [])) {
    const n = String(pr?.name || '');
    const m = n.match(/^([^·]{2,6}?)[·（]/);
    if (m) myCities.add(m[1]);
    if (pr?.city) myCities.add(String(pr.city));
  }
  let removed = 0;
  for (const [pid, p] of Object.entries(world?.places || {})) {
    if (!p || p.parent || !p.rooms) continue;
    if (!/衙|县衙|府衙|公堂/.test(String(p.name || ''))) continue;
    const cityOf = String(p.name || '').split('·')[0];
    if (myCities.has(cityOf) || /临江|京城/.test(String(p.name || ''))) continue;
    for (const r of Object.values(p.rooms)) {
      if (r?.id && world.places[r.id]) { delete world.places[r.id]; removed += 1; }
    }
    delete p.rooms;
  }
  return removed;
}

/**
 * 相公调配府内眷属居所单一入口（自由分房调迁令）
 */
export function assignChamber(world, actorQuery, roomQuery, { orderedBy = 'husband' } = {}) {
  const actorStr = String(actorQuery || '').trim();
  const roomStr = String(roomQuery || '').trim();
  if (!actorStr || !roomStr) return { ok: false, error: '缺少人名或房名' };

  // 1. 查找内眷
  const actors = Object.values(world.actors || {});
  let targetActor = actors.find((a) => a && (a.id === actorStr || a.name === actorStr));
  if (!targetActor) {
    targetActor = actors.find((a) => a && (
      (a.name && (a.name.includes(actorStr) || actorStr.includes(a.name))) ||
      (a.role && a.role.includes(actorStr))
    ));
  }
  if (!targetActor) return { ok: false, error: `府内查无此人：${actorStr}` };

  // 2. 查找府内房间
  const places = Object.values(world.places || {});
  const mansionPlaces = places.filter((p) => p && (
    p.id === 'husband_room' ||
    (p.id && String(p.id).startsWith('wang_mansion')) ||
    (p.parent && (p.parent === 'wang_mansion' || p.parent === 'husband_room')) ||
    String(p.name || '').includes('王府') ||
    String(p.name || '').includes('王宅')
  ));

  let targetPlace = mansionPlaces.find((p) => p && (p.id === roomStr || p.name === roomStr));
  if (!targetPlace) {
    // 模糊匹配
    if (/正房|暖阁|上房|上堂|寝堂/.test(roomStr)) {
      targetPlace = mansionPlaces.find((p) => p && (p.id === 'wang_mansion__main_room' || p.id === 'husband_room' || /正房/.test(p.name)));
    } else if (/东跨|东院|东厢/.test(roomStr)) {
      targetPlace = mansionPlaces.find((p) => p && (p.id === 'wang_mansion_east' || p.id === 'wang_mansion__east' || /东厢|东跨/.test(p.name)));
    } else if (/西跨|西院|西厢/.test(roomStr)) {
      targetPlace = mansionPlaces.find((p) => p && (p.id === 'wang_mansion_west' || p.id === 'wang_mansion__west' || /西厢|西跨/.test(p.name)));
    } else if (/后罩|下房|丫鬟房/.test(roomStr)) {
      targetPlace = mansionPlaces.find((p) => p && (p.id === 'wang_mansion__servant' || /后罩|下房/.test(p.name)));
    } else if (/花园|临波/.test(roomStr)) {
      targetPlace = mansionPlaces.find((p) => p && (p.id === 'wang_mansion__garden' || /花园/.test(p.name)));
    }
  }

  if (!targetPlace) {
    targetPlace = places.find((p) => p && (p.id === roomStr || p.name === roomStr || String(p.name).includes(roomStr)));
  }

  if (!targetPlace) return { ok: false, error: `府内查无此居所：${roomStr}` };

  // 3. 权威更动并永久锁定相公钦定标识
  targetActor.home = targetPlace.id;
  targetActor.quarters = targetPlace.id;
  targetActor.chamber = targetPlace.id;
  targetActor.assignedRoom = targetPlace.id;
  targetActor.assignedBy = orderedBy;
  targetActor.assignedAt = world.clock?.day || 26;

  // 4. 物理搬迁（以 ui 操作权限确保顺利入驻）
  moveActor(world, targetActor.id, targetPlace.id, 'ui', `相公恩旨安置居所至${targetPlace.name}`);

  return {
    ok: true,
    actor: targetActor,
    place: targetPlace,
    message: `${targetActor.name} 已遵旨迁入【${targetPlace.name}】`,
  };
}

/**
 * 升格相公宅邸为「提督王府」（单一入口）
 */
export function upgradeToMansionPalace(world, { force = false } = {}) {
  const me = world.actors?.husband;
  const rank = String(me?.role || '');
  const isHighOfficer = /从一品|正一品|正二品|提督|总督|总兵/.test(rank) || force;

  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
  const mansionProp = props.find((p) => p && (p.id === 'wang_mansion' || p.placeId === 'husband_room' || /王宅/.test(p.name)));
  if (!mansionProp) return false;

  const oldName = mansionProp.name;
  const newMansionTitle = '临江·提督王府（一品军门府邸）';
  const prefix = '临江·提督王府·';

  // 1. 更新资产表
  mansionProp.name = newMansionTitle;
  mansionProp.desc = '临江城中七进三进三出深宅大院，飞檐斗拱、气势恢宏，乃从一品水陆提督军门府邸，开府建牙、中军亲卫列宿。后宅正房、东跨院、西厢房一应俱全。';

  // 2. 更新主地点与所有子地点名称
  let renamedPlaces = 0;
  for (const [pid, p] of Object.entries(world.places || {})) {
    if (!p) continue;
    if (pid === 'husband_room' || pid === 'wang_mansion' || pid.startsWith('wang_mansion_') || pid.startsWith('wang_mansion__')) {
      const roomPart = String(p.name || '').replace(/^临江·(王宅|提督王府)·?/, '') || '正房暖阁';
      const newPlaceName = `${prefix}${roomPart}`;
      if (p.name !== newPlaceName) {
        p.name = newPlaceName;
        renamedPlaces += 1;
      }
    }
  }

  // 3. 补记大事记与里程碑
  world.milestones = Array.isArray(world.milestones) ? world.milestones : [];
  if (!world.milestones.some((m) => m && m.id === 'upgrade_to_mansion_palace')) {
    world.milestones.push({
      id: 'upgrade_to_mansion_palace',
      type: 'residence_upgrade',
      day: world.clock?.day || 26,
      title: '临江王宅升格提督王府',
      desc: '相公官拜从一品水陆提督总兵官，开府建牙，钦定将临江王宅正式正名升格为从一品“提督王府”，朱红九叠篆金匾高悬！',
      impact: '府邸威仪倍增，地方文武百官登门参谒，家眷内外齐整肃穆。',
    });
  }

  return { ok: true, oldName, newName: newMansionTitle, renamedPlaces };
}
