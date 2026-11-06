/**
 * 世界自己往前走：每个时辰推一格，不写一句台词。
 *
 * 这一层只改事实（价格、民心、粮、债），不碰对话、不碰戏。
 * 天道要讲的时候，读的是这里推出来的结果。
 *
 * 铁律：
 *   ① 单一写入口：钱走 money.js，人走 moveActor，势力走 factions；
 *   ② 每一格都要能追：谁变了、为什么变，进 events；
 *   ③ 不许制造"无事发生"的假推进——没变化就不写。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round(num(v) * 100) / 100;

/** 季节对粮价的影响（秋收落、春荒涨） */
function seasonFactor(season) {
  switch (String(season || '')) {
    case 'autumn': return 0.94;   // 新谷上市
    case 'winter': return 1.06;   // 封河，运输贵
    case 'spring': return 1.08;   // 青黄不接
    default: return 1.0;
  }
}

/**
 * 推进一个时辰
 * @returns {{grain:number, cities:number, note:string}}
 */
export function advanceWorldTick(world, hour) {
  const h = num(hour);
  // 只在换时辰时推一次（clock 每个时辰调一次，这里再兜一层）
  world.flags = world.flags || {};
  const day = num(world.clock?.day) || 1;
  const stamp = `${day}-${h}`;
  if (world.flags.lastTick === stamp) return { grain: 0, cities: 0, note: '同一时辰不重复推' };
  world.flags.lastTick = stamp;

  let note = '';

  // ── ① 粮价：随季节、灾荒、商路缓慢浮动（不改到离谱）──
  let grainMoved = 0;
  try {
    world.market = world.market || {};
    const g = world.market.grain;
    if (g) {
      const base = num(g.base) || 0.4;
      const cur = num(g.index) || 1;
      const drift = (Math.random() - 0.5) * 0.02;            // 市井自然起伏 ±1%
      const season = seasonFactor(world.clock?.season);
      let next = cur * (1 + drift) * (1 + (season - 1) * 0.02);
      // 灾荒：有灾的城会把周边粮价抬起来
      const disasters = (world.events || []).filter((e) => e && e.action === 'disaster' && Number(e.day) >= day - 2);
      if (disasters.length) next *= 1 + Math.min(0.06, disasters.length * 0.02);
      next = Math.max(0.7, Math.min(2.2, next));
      if (Math.abs(next - cur) > 0.005) {
        g.index = Math.round(next * 1000) / 1000;
        grainMoved = Math.round((g.index - cur) * 1000) / 10;
      }
    }
    if (grainMoved !== 0) note += `米价${grainMoved > 0 ? '涨' : '跌'}${Math.abs(grainMoved)}%`;
  } catch { /* 忽略 */ }

  // ── ② 民心：税重则散、粮贵则怨、太平则安（每个时辰只挪一点点）──
  let citiesMoved = 0;
  try {
    const price = num(world.market?.grain?.index) || 1;
    for (const c of Object.values(world.cities || {})) {
      if (!c || c.name == null) continue;
      const tax = num(c.tax);
      const before = num(c.unrest);
      let delta = 0;
      if (tax >= 30) delta += 0.4;
      else if (tax >= 20) delta += 0.2;
      else if (tax <= 10) delta -= 0.2;
      if (price >= 1.3) delta += 0.3;
      else if (price <= 0.85) delta -= 0.2;
      if (delta === 0) continue;
      const after = Math.max(0, Math.min(100, before + delta));
      if (Math.abs(after - before) < 0.05) continue;
      c.unrest = Math.round(after * 10) / 10;
      citiesMoved += 1;
    }
    if (citiesMoved) note += `${note ? '；' : ''}${citiesMoved} 城民心有动`;
  } catch { /* 忽略 */ }

  // ── ③ 债：欠着的钱按时辰生息（日息万分之三，古时"三分利"太狠，这里温和）──
  try {
    const loans = Array.isArray(world.loans) ? world.loans : [];
    for (const l of loans) {
      if (!l || l.settled) continue;
      const principal = num(l.principal);
      if (principal <= 0) continue;
      const interest = round2(principal * 0.0003);
      if (interest > 0) {
        l.owed = round2(num(l.owed || principal) + interest);
      }
    }
  } catch { /* 忽略 */ }

  return { grain: grainMoved, cities: citiesMoved, note: note || '无事' };
}
