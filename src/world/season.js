/**
 * 物候：季节与天气对人间有物理制约。
 *
 * 只做四件事（都是"事"，不是"台词"）：
 *   ① 冬天运河封冻：漕运/茶栈类产业进项腰斩，粮价上浮
 *   ② 春耕秋收：此时大举募兵，伤了农时，城会穷
 *   ③ 冬雨雪：行军翻倍慢
 *   ④ 灾后疫病：灾荒之后有概率起疫，民心受挫
 *
 * 所有判断都从 world.clock.season / weather 来，不写死日期。
 */

import { neighborRegions } from './geography.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 季节：spring / summer / autumn / winter（state.js 已算好，这里只读） */
export function seasonOfWorld(world) {
  return String(world?.clock?.season || 'spring');
}

/** 运河是否封冻：隆冬即冻 */
export function canalFrozen(world) {
  return seasonOfWorld(world) === 'winter';
}

/** 农时：春耕、秋收（此间抽丁伤农） */
export function farmSeason(world) {
  const s = seasonOfWorld(world);
  return s === 'spring' || s === 'autumn';
}

/** 行的路：冬天慢一倍，暴雨再慢半倍 */
export function marchSpeedFactor(world) {
  let f = 1;
  if (canalFrozen(world)) f *= 2;
  const weather = String(world?.clock?.weather || '');
  if (/雨|雪|暴/.test(weather)) f *= 1.5;
  return f;
}

/** 产业受物候影响：返回进项系数 */
export function propertySeasonFactor(world, prop) {
  const name = String(prop?.name || '');
  let f = 1;
  // 水路生意：冬天封河，几乎停摆
  if (/栈|运|漕|码头|船/.test(name) && canalFrozen(world)) f *= 0.35;
  // 茶：春茶贵、冬茶贱
  if (/茶/.test(name)) {
    const s = seasonOfWorld(world);
    if (s === 'spring') f *= 1.15;
    if (s === 'winter') f *= 0.85;
  }
  // 酒：冬令旺
  if (/酒/.test(name) && seasonOfWorld(world) === 'winter') f *= 1.2;
  return f;
}

/** 疫病：灾荒之后有概率起疫（由 clock 每日调用，返回是否起疫） */
export function maybeOutbreak(world, events, nextEvent) {
  const today = Number(world.clock?.day) || 1;
  const disasters = (events || []).filter((e) => e && e.action === 'disaster').length;
  if (!disasters) return false;
  if (Math.random() > 0.25) return false;

  // 只在本道与相邻道扩散，不做全国一刀切
  const region = String((events[0] && events[0].place) || world.actors?.husband?.place || '');
  const spreadRegions = new Set();
  if (region) {
    spreadRegions.add(region);
    for (const nb of neighborRegions(world, region)) spreadRegions.add(nb);
  }
  let hit = 0;
  for (const ct of Object.values(world.cities || {})) {
    if (!ct) continue;
    const r = String(ct.region || '');
    if (spreadRegions.size && !spreadRegions.has(r)) continue;
    ct.unrest = Math.min(100, num(ct.unrest) + 5);
    hit += 1;
  }
  events.push(nextEvent(world, {
    action: 'plague', actor: 'system', place: null,
    payload: { text: `灾后疫气蔓延，${hit} 城民心浮动` }, isPublic: true,
  }));
  return true;
}

/** 军械需铁：铁的行情差，募兵与军械更贵 */
export function gearCostFactor(world) {
  const iron = num(world?.market?.iron?.index) || 1;
  return Math.max(0.7, Math.min(2.5, iron));
}
