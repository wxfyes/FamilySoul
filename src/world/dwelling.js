/**
 * 住处与作息：谁的家、谁能待在私宅里。
 *
 * 铁律：
 *   ① 私宅（residence）不是公共场所，只属于它的主人与主人的家眷、雇工；
 *   ② 天道临时立起来的过门人，必须有自己的家与作息，绝不许把玩家的院子当自己家；
 *   ③ 赖在别人宅子里的，到了夜里或待够四个时辰，就自己出去。
 */

import { moveActor } from './position.js';
import { getPlaceDisplayName } from './naming.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 他是不是这座宅子的人（主人 / 家眷 / 雇工 / 掌柜） */
export function mayStayIn(world, actor, placeId) {
  if (!actor) return false;
  const place = world?.places?.[placeId];
  if (!place) return false;
  if (place.owner && place.owner === actor.id) return true;
  if (place.keeper && place.keeper === actor.id) return true;
  const owner = place.owner;
  if (owner === 'husband' && (actor.id === 'husband' || actor.household || actor.spouse === 'husband')) return true;
  if (actor.employer && actor.employer === owner) return true;
  const props = Array.isArray(world?.assets?.properties) ? world.assets.properties : [];
  const here = props.find((p) => p && (p.place === placeId));
  if (here && (here.keeper === actor.id || (Array.isArray(here.staffIds) && here.staffIds.includes(actor.id)))) return true;
  // 自己家：必须这宅子本来就是他的（无主或主人是他），不能靠 home 字段自证
  const home = world?.places?.[actor.home];
  if (home && home.id === placeId && (!home.owner || home.owner === actor.id)) return true;
  return false;
}

/**
 * 给一个没有住处的人安个家（唯一入口）
 * @returns {string} 住处 placeId
 */
export function ensureDwelling(world, actorId, actorName, nearPlaceId = 'street') {
  world.places = world.places || {};
  // 已经有家且不是别人的私宅，就用它
  const a = world?.actors?.[actorId];
  const curHome = a?.home ? world.places[a.home] : null;
  if (curHome && (curHome.owner === actorId || !curHome.residence)) return a.home;

  world.flags = world.flags || {};
  let pid = '';
  do {
    world.flags.dwellingSeq = num(world.flags.dwellingSeq) + 1;
    pid = `house_${world.flags.dwellingSeq}`;
  } while (world.places[pid]);
  const near = world.places[nearPlaceId] || world.places.street;
  world.places[pid] = {
    id: pid,
    name: `${actorName}家`,
    exits: near?.id ? [near.id] : ['street'],
    residence: true,
    owner: actorId,
    dynamic: true,
  };
  if (near) {
    near.exits = Array.isArray(near.exits) ? near.exits : [];
    if (!near.exits.includes(pid)) near.exits.push(pid);
  }
  return pid;
}

/** 一份像样的作息（按身份类别给，不留空表） */
export function defaultSchedule(role = '', placeId = 'street', homeId = 'street') {
  const r = String(role || '');
  if (/货郎|小贩|行商|客商/.test(r)) {
    return [
      { at: 7, do: '挑担出门做买卖', place: placeId },
      { at: 12, do: '在街口用饭', place: placeId },
      { at: 18, do: '收摊回家', place: homeId },
      { at: 21, do: '安歇', place: homeId },
    ];
  }
  if (/差役|衙役|更夫|捕快/.test(r)) {
    return [
      { at: 6, do: '去衙门当差', place: 'yamen' },
      { at: 12, do: '衙前用饭', place: 'yamen' },
      { at: 19, do: '下值回家', place: homeId },
      { at: 22, do: '安歇', place: homeId },
    ];
  }
  if (/婆|婶|娘|嫂|妇|绣|洗衣|卖花/.test(r)) {
    return [
      { at: 7, do: '起来收拾屋子', place: homeId },
      { at: 9, do: '出门做些零活', place: placeId },
      { at: 12, do: '回家用饭', place: homeId },
      { at: 20, do: '掌灯歇息', place: homeId },
    ];
  }
  return [
    { at: 7, do: '起身开门', place: homeId },
    { at: 9, do: '出门营生', place: placeId },
    { at: 12, do: '用饭歇晌', place: placeId },
    { at: 18, do: '收工回家', place: homeId },
    { at: 21, do: '安歇', place: homeId },
  ];
}

/**
 * 私宅巡检：不是这宅子的人，待够四个时辰或入夜就请出去（每小时跑一次）
 * @returns {Array} 事件
 */
export function evictTrespassers(world, events, nextEvent) {
  const out = [];
  const hour = num(world.clock?.hour);
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    const place = world.places?.[a.location];
    if (!place || !place.residence) {
      if (a.trespassHours) a.trespassHours = 0;
      continue;
    }
    if (mayStayIn(world, a, a.location)) {
      a.trespassHours = 0;
      continue;
    }
    a.trespassHours = num(a.trespassHours) + 1;
    const night = hour >= 20 || hour < 5;
    if (a.trespassHours < 4 && !night) continue;

    const back = a.home && world.places?.[a.home] && a.home !== a.location ? a.home : 'street';
    const r = moveActor(world, a.id, back, 'world');
    if (r?.ok) {
      a.trespassHours = 0;
      out.push({
        action: 'evicted',
        actor: a.id,
        place: back,
        payload: { text: `${a.name}在${getPlaceDisplayName(world, a.location)}待久了不便，回了${getPlaceDisplayName(world, back)}` },
        isPublic: false,
      });
      events?.push(nextEvent(world, out[out.length - 1]));
    }
  }
  return out;
}

/** 历史脏数据：把人家的私宅当成自己家的，纠正回自家或街头（一次性） */
export function repairTrespassHomes(world, events, nextEvent) {
  const out = [];
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    const home = world.places?.[a.home];
    if (!home || !home.residence) continue;
    if (mayStayIn(world, a, a.home)) continue;
    const own = ensureDwelling(world, a.id, a.name || '某人', a.location && !world.places?.[a.location]?.residence ? a.location : 'street');
    a.home = own;
    if (a.location === home.id) a.location = own;
    if (!Array.isArray(a.schedule) || !a.schedule.length) {
      a.schedule = defaultSchedule(a.role, 'street', own);
    }
    out.push({ action: 'home_repaired', actor: a.id, place: own, payload: { text: `${a.name}搬回自己家里住` }, isPublic: false });
    events?.push(nextEvent(world, out[out.length - 1]));
  }
  return out;
}
