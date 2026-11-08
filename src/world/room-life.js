/**
 * 院子里的生活：每一间院子有什么陈设、住着谁、这个时辰该在哪、在这里能做什么。
 *
 * 规矩：
 *   ① 陈设由"这间院子的用处"推出来（卧室/书房/账房/庖厨/库房/花园/祠堂/马厩/门房…）；
 *   ② 作息由"他住哪间 + 这间是干什么的"推出来，不写死某个人几点做什么；
 *   ③ "能做什么"只给事实（有账册、有灶、有花），做不做、怎么做，交给天道与玩家。
 */

import { materializeRoom } from './residence.js';
import { gatePostPlace } from './posts.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 按用处给陈设（返回名词短语，供天道当事实用） */
export function furnishingsFor(use) {
  switch (String(use || '')) {
    case 'bedroom':
      return ['拔步床', '妆台铜镜', '衣柜', '熏香炉', '灯台'];
    case 'study':
      return ['书案', '笔砚', '书架', '灯烛', '墙上字画'];
    case 'office':
      return ['账桌', '算盘', '账簿', '银匣', '秤'];
    case 'kitchen':
      return ['灶台', '水缸', '砧板', '碗柜', '柴堆'];
    case 'servant':
      return ['通铺', '针线篮', '水盆', '粗布衣裳'];
    case 'store':
      return ['货架', '麻袋', '封条', '斗与秤'];
    case 'garden':
      return ['假山', '池塘', '石桌石凳', '花圃', '回廊'];
    case 'shrine':
      return ['牌位', '香案', '蒲团', '长明灯'];
    case 'stable':
      return ['马槽', '草料', '马鞍架', '水桶'];
    case 'guard':
      return ['兵器架', '更鼓', '铺盖', '门闩'];
    case 'gate':
      return ['门房桌', '门闩', '灯笼', '名刺匣'];
    case 'hall':
      return ['太师椅', '条案', '匾额', '字画', '茶具'];
    case 'shop_floor':
      return ['散座', '柜台', '酒旗', '账台'];
    case 'workshop':
      return ['作坊台', '原料架', '成品架'];
    case 'jail':
      return ['栅栏', '刑具架', '稻草铺'];
    case 'yard':
      return ['石阶', '花木', '水缸', '影壁'];
    default:
      return ['桌椅', '灯台'];
  }
}

/** 这间院子此刻有谁 */
export function occupantsOf(world, placeId) {
  return Object.values(world?.actors || {})
    .filter((a) => a && !a.dead && a.location === placeId)
    .map((a) => ({ id: a.id, name: a.name, role: a.role || '', activity: a.activity?.text || '' }));
}

/** 在这间院子"能做的事"（只给事实，不给台词） */
export function affordancesOf(use, actor) {
  const list = [];
  switch (String(use || '')) {
    case 'study':
      list.push('读书', '翻账册', '写帖子');
      break;
    case 'office':
      list.push('看账', '点银', '核货单');
      break;
    case 'kitchen':
      list.push('吩咐灶上做饭', '尝汤', '看米面还剩多少');
      break;
    case 'garden':
      list.push('赏花', '临池闲坐', '在石桌上下棋');
      break;
    case 'shrine':
      list.push('上香', '看牌位', '祭祖');
      break;
    case 'bedroom':
      list.push('歇息', '换衣裳', '说话');
      break;
    case 'store':
      list.push('清点存货', '查封条');
      break;
    case 'stable':
      list.push('看马', '吩咐备车');
      break;
    case 'guard':
      list.push('点兵', '察看兵器');
      break;
    case 'shop_floor':
      list.push('坐下吃茶', '唤伙计', '听曲');
      break;
    default:
      list.push('坐一坐', '看看四周');
  }
  if (actor && /妻|妾|丫鬟/.test(String(actor.role || ''))) list.push('与内眷说话');
  return list;
}

/**
 * 院落总览：给天道与客户端用
 * @returns {{id:string,name:string,use:string,parent:string,furnish:string[],occupants:object[],can:string[]}}
 */
export function describeRoom(world, placeId) {
  const p = world?.places?.[placeId];
  if (!p) return null;
  const parent = p.parent ? world.places?.[p.parent] : null;
  return {
    id: p.id,
    name: p.name || '',
    use: p.use || (parent ? 'room' : 'place'),
    parent: p.parent || '',
    parentName: parent?.name || '',
    furnish: furnishingsFor(p.use),
    occupants: occupantsOf(world, placeId),
    can: affordancesOf(p.use),
    depth: p.depth || null,
    access: p.access || null,
    floor: p.floor || null,
  };
}

/**
 * 按"他住哪间 + 这间的用处"推他这一天的作息（不写死姓名）
 * @returns {Array<{at:number,do:string,place:string}>}
 */
export function routineFor(world, actor) {
  if (!actor) return [];
  const homeId = actor.home;
  const home = world?.places?.[homeId];
  if (!home) return [];
  // 找他的住处（quarters 优先，其次家宅本身）
  const quarters = actor.quarters && world.places?.[actor.quarters] ? actor.quarters : null;
  const isServant = /丫鬟|丫头|小厮|护院|家丁|厨|账房|马夫|车夫/.test(String(actor.role || ''));

  // 有营生去处的外城百工：白天在营生处，夜里回家（临江名角不走这条，保持原样）
  const workId = actor.origin === 'city_base' && actor.workplaceId && world.places?.[actor.workplaceId]
    ? actor.workplaceId
    : null;
  if (workId) {
    return [
      { at: 6, do: '起来收拾', place: quarters || homeId },
      { at: 8, do: '出工', place: workId },
      { at: 12, do: '用饭歇晌', place: workId },
      { at: 18, do: '收工', place: workId },
      { at: 21, do: '回家安歇', place: quarters || homeId },
    ];
  }

  if (isServant) {
    // 下人：早起当差 → 晚饭 → 回下房
    return [
      { at: 6, do: '起来收拾', place: quarters || homeId },
      { at: 7, do: '当差', place: homeId },
      { at: 12, do: '用饭歇晌', place: homeId },
      { at: 18, do: '收工', place: homeId },
      { at: 21, do: '回下房安歇', place: quarters || homeId },
    ];
  }
  // 主人家眷：晨起正房、白天厅堂/花园、夜里回房
  // 注：内眷行止由天道（大模型）按心事/差事安排，不由钟点硬搬；此表只作兜底
  return [
    { at: 7, do: '起身梳洗', place: quarters || homeId },
    { at: 9, do: '在中堂理事', place: homeId },
    { at: 12, do: '用饭', place: homeId },
    { at: 15, do: '在后花园走走', place: homeId },
    { at: 19, do: '掌灯用饭', place: homeId },
    { at: 22, do: '回房安歇', place: quarters || homeId },
  ];
}

/**
 * 到他该去的那间院子（房间没展开就先展开）
 * @returns {string|null} 实际去的 placeId
 */
export function roomForHour(world, actor, hour) {
  const routine = routineFor(world, actor);
  if (!routine.length) return null;
  // 内眷不按钟点搬：她去哪由天道（大模型）按心事/差事决定
  if (actor.household) return null;
  // 只有背景人群与当差下人按钟点走（城里要有潮汐）；有名有姓的剧情人物一律交给天道
  const isBackground = actor.origin === 'city_base' || actor.servant === true || /^(staff_|maid_)/.test(String(actor.id || ''));
  if (!isBackground) return null;

  // 门房当值：白天守大门，夜里回下房
  if (actor?.duty?.post === 'gate') {
    const postPlace = gatePostPlace(world, actor);
    if (postPlace) return postPlace;
  }
  const slot = routine.filter((s) => num(s.at) <= num(hour)).pop() || routine[0];
  let pid = slot.place;
  // 目标还是"账上的院子"（没展开）→ 先展开
  if (pid && !world.places?.[pid] && String(pid).includes('__')) {
    const [parentId, key] = String(pid).split('__');
    pid = materializeRoom(world, parentId, key) || parentId;
  }
  // 如果作息指向的是"账上的院子"（id 里带 __ 但还没展开），先展开
  if (pid && String(pid).includes('__') && !world.places?.[pid]) {
    const [parentId, key] = String(pid).split('__');
    pid = materializeRoom(world, parentId, key) || parentId;
  }
  // 主人家眷去"中堂/后花园"时，若账上有对应院子就展开它，否则留在宅门
  if (!String(pid).includes('__') && world.places?.[pid]?.rooms) {
    const wantUse = num(hour) >= 15 && num(hour) < 19 ? 'garden' : null;
    const rooms = world.places[pid].rooms;
    const key = wantUse && rooms[wantUse] ? wantUse : null;
    if (key) {
      const made = materializeRoom(world, pid, key);
      if (made) pid = made;
    }
  }
  return pid;
}
