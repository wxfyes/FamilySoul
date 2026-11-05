/**
 * 岁时：人会老，孩子会长，家业要有人接。
 *
 * 规则（全部是事实，不写剧情）：
 *   · 每 30 个世界日长一岁
 *   · 十五及冠、十四及笄：换身份、可当家、可婚配
 *   · 五十之后体魄渐衰，六十以后每年有概率病故
 *   · 孩子按年纪分段（襁褓/垂髫/束发/及冠），身份随之改
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const DAYS_PER_YEAR = 30;

const STAGES = [
  { until: 3, role: '襁褓婴孩' },
  { until: 9, role: '垂髫小儿' },
  { until: 13, role: '总角童子' },
  { until: 14, role: '束发少年' },
];

/** 每日：长岁、及冠、衰朽 */
export function runAging(world, events, nextEvent) {
  const day = Number(world.clock?.day) || 1;
  if (day % DAYS_PER_YEAR !== 0) return;

  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    // 只让"有父母/家眷/官员"这些人变老，避免一次性给 160 人加岁
    const trackable = a.household || Array.isArray(a.parents) || a.id === 'husband' || a.court || a.office;
    if (!trackable) continue;

    const age = num(a.age);
    if (!(age > 0)) continue;
    a.age = age + 1;

    // 体魄：五十之后渐衰
    if (a.age >= 50) {
      a.physique = Math.max(10, 100 - (a.age - 50) * 3);
    } else if (a.physique === undefined) {
      a.physique = 100;
    }

    // 孩子分段
    if (Array.isArray(a.parents) && a.parents.length) {
      let role = a.role || '';
      for (const s of STAGES) {
        if (a.age <= s.until) { role = s.role; break; }
      }
      if (a.age >= 15 && /婴孩|小儿|童子|少年/.test(String(role))) {
        role = a.gender === 'female' ? '及笄之女' : '及冠少年';
      }
      if (role !== a.role) a.role = role;
    }

    // 及冠：十五岁
    if (a.age === 15 && !a.capped) {
      a.capped = { day };
      events.push(nextEvent(world, {
        action: 'coming_of_age', actor: a.id, place: a.location || null,
        payload: { text: `${a.name}年满十五，行及冠礼` }, isPublic: true,
      }));
    }

    // 老病：六十以后每年有概率病故（由既有生死逻辑收尾）
    if (a.age >= 60) {
      const p = Math.min(0.5, (a.age - 59) * 0.04);
      if (Math.random() < p) {
        a.sick = { day, note: '年老体衰' };
      }
    }
  }
}

/** 传承：谁接谁的家业（给后续继承用） */
export function heirsOf(world, actorId) {
  const a = world.actors?.[actorId];
  if (!a) return [];
  return Object.values(world.actors || {})
    .filter((x) => x && !x.dead && Array.isArray(x.parents) && x.parents.includes(actorId))
    .sort((x, y) => num(y.age) - num(x.age));
}
