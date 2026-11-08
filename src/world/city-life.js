/**
 * 城市生活层：大户、富商、才女、公子、乡绅不是布景板。
 *
 * 全部本地规则，不调用模型：
 *   · 每人一份稳定的心愿（goals）
 *   · 一份按身份排的作息（schedule），到点由 runSchedules 真移动
 *   · 只有相公真的碰到、开口，才进入关系与记忆
 *
 * 不点名、不钦定，谁和谁遇见由作息与地点自己碰出来。
 */

import { moveActor } from './position.js';

const GOALS = {
  富商: ['做成一笔大买卖', '摸清城里的行情', '给自家字号扬名'],
  才女: ['寻一个真懂诗的人', '攒钱刻自己的集子', '看看城外的山水'],
  公子: ['结交几位名士', '考取功名', '替家里撑起门面'],
  小姐: ['寻一门合意的亲事', '学一套持家的本事', '把女红做到最好'],
  乡绅: ['守住祖上的田产', '给儿女议一门亲', '在街面上留个好名声'],
  老爷: ['守住家业', '给儿女铺路', '在官面上留几分体面'],
  夫人: ['把内宅理顺', '给儿女留心婚事', '拢住家里的银钱'],
};

const ROLE_KEYS = Object.keys(GOALS);

function goalsOf(role) {
  const key = ROLE_KEYS.find((k) => String(role || '').includes(k));
  return key ? GOALS[key].slice() : null;
}

function baseOf(world, a) {
  const city = String(world.places?.[a.home]?.name || world.places?.[a.location]?.name || '临江府').split('·')[0];
  const b = world.flags?.cityBase?.[city] || null;
  return {
    city,
    street: b?.streetId || 'street',
    market: b?.marketId || b?.streetId || 'street',
    home: a.home && world.places?.[a.home] ? a.home : (b?.streetId || 'street'),
  };
}

function scheduleOf(world, a) {
  const role = String(a.role || '');
  const b = baseOf(world, a);
  if (/公子|小姐/.test(role)) {
    return [
      { at: 8, do: '在府里用早膳', place: b.home },
      { at: 10, do: '出门会友', place: b.market },
      { at: 13, do: '在茶坊坐一坐', place: b.market },
      { at: 17, do: '回府', place: b.home },
      { at: 21, do: '安歇', place: b.home },
    ];
  }
  if (/富商/.test(role)) {
    return [
      { at: 7, do: '去市集看行情', place: b.market },
      { at: 12, do: '在茶坊会客', place: b.market },
      { at: 15, do: '回铺子理账', place: b.market },
      { at: 18, do: '在长街走动', place: b.street },
      { at: 21, do: '回住处歇息', place: b.home },
    ];
  }
  if (/才女/.test(role)) {
    return [
      { at: 8, do: '在窗下读书', place: b.home },
      { at: 10, do: '去书铺看看', place: b.market },
      { at: 13, do: '在茶坊听人说话', place: b.market },
      { at: 17, do: '沿长街慢慢走', place: b.street },
      { at: 21, do: '回屋安歇', place: b.home },
    ];
  }
  if (/乡绅/.test(role)) {
    return [
      { at: 7, do: '在街上转转', place: b.street },
      { at: 10, do: '去茶坊听行情', place: b.market },
      { at: 14, do: '看田租账目', place: b.home },
      { at: 18, do: '在长街会人', place: b.street },
      { at: 21, do: '回家安歇', place: b.home },
    ];
  }
  return [
    { at: 7, do: '起身理事', place: b.home },
    { at: 10, do: '出门走动', place: b.street },
    { at: 18, do: '回家', place: b.home },
    { at: 21, do: '安歇', place: b.home },
  ];
}

export function ensureCityLife(world) {
  let made = 0;
  let homed = 0;
  for (const a of Object.values(world?.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (a.origin !== 'city_class' && !ROLE_KEYS.some((k) => String(a.role || '').includes(k))) continue;
    // 城郊大户被历史漂移堆到临江长街的，先归回本城本宅
    const home = world.places?.[a.home];
    // 外城大户不是王宅的人，绝不能借 household 混进相公文书/内宅名单
    if (a.origin === 'city_class' && a.household && !String(a.home || '').startsWith('husband_room')) {
      delete a.household;
    }
    if (a.origin === 'city_class' && home && a.home !== 'street' && a.location === 'street' && !a.cityLifeHomed) {
      const mv = moveActor(world, a.id, a.home, 'world', '归家');
      if (mv?.ok) { a.cityLifeHomed = true; homed += 1; }
    }
    let changed = false;
    if (!Array.isArray(a.goals) || a.goals.length === 0) {
      const goals = goalsOf(a.role);
      if (goals) { a.goals = goals; changed = true; }
    }
    if (!Array.isArray(a.schedule) || a.schedule.length === 0) {
      a.schedule = scheduleOf(world, a);
      changed = true;
    }
    if (changed) made += 1;
  }
  if (made || homed) console.log(`[CityLife] 给 ${made} 个城中人补上心愿与作息，${homed} 人归回本城本宅（本地规则，不耗模型）`);
  return made + homed;
}
