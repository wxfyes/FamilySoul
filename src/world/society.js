/**
 * 民间自愈（society）
 *
 * 世界的"谁该在哪、在做什么"不写死规则，交给天道自己回一遍：
 *   ① 引擎只负责判断"这里不对劲"（一堆人挤在街上、铺子掌柜不在店…）
 *   ② 把现状交给天道，让它给出每个人的位置与营生
 *   ③ 引擎照单落账，写进事件流
 *
 * 不做任何角色/职业的正则判定——那是剧本。
 */

/**
 * 街上闲人：站在街/巷/路口的人。
 * 摆摊挑担的本来就该在街上——所以不在这层判断，
 * 把名单交给天道，由它决定谁该回铺子、谁本来就该在街上。
 */
export function collectDrifters(world) {
  const streetIds = Object.entries(world.places || {})
    .filter(([, p]) => /街|巷|路口|市$/.test(String(p?.name || '')))
    .map(([id]) => id);
  if (!streetIds.length) return null;
  const list = Object.values(world.actors || {})
    .filter((a) => a && !a.dead && !a.humanBound && streetIds.includes(a.location) && a.id !== 'husband')
    .slice(0, 24);
  if (list.length < 3) return null;
  return {
    placeName: world.places?.[list[0].location]?.name || '街市',
    stuck: list.map((a) => ({ id: a.id, name: a.name, role: a.role || '' })),
  };
}

/** 同类富集：某个地点的人是不是多得不正常 */
export function detectDrift(world) {
  const byPlace = {};
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || !a.location) continue;
    byPlace[a.location] = (byPlace[a.location] || 0) + 1;
  }
  const entries = Object.entries(byPlace).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (total < 8) return null;
  const [topId, topCount] = entries[0] || [];
  // 超过四成的人挤在同一个地方 = 不对劲
  if (!topId || topCount / total < 0.35) return null;
  const topName = world.places?.[topId]?.name || topId;
  const stuck = Object.values(world.actors || {})
    .filter((a) => a && !a.dead && a.location === topId && a.id !== 'husband' && !a.humanBound)
    .slice(0, 28)
    .map((a) => ({ id: a.id, name: a.name, role: a.role || '' }));
  if (stuck.length < 6) return null;
  return { placeId: topId, placeName: topName, count: topCount, total, stuck };
}

/** 拼给天道看的一页现状 */
export function buildDriftPrompt(world, drift) {
  const places = Object.entries(world.places || {})
    .filter(([, p]) => p && p.name && !p.private)
    .slice(0, 120)
    .map(([id, p]) => `${p.name}`)
    .join('、');

  const people = drift.stuck
    .map((a) => `- ${a.name}（${a.role || '身份不明'}）`)
    .join('\n');

  const system = [
    '你是这个世界天道。眼下人间时序错乱：太多人挤在同一处，铺子衙门空着。',
    '请按各人身份与本分，把他们安顿回该在的地方。',
    '只输出 JSON，不要解释：',
    '{"placements":[{"name":"人名","place":"地点名（必须来自我给的地点表）","activity":"此刻在做什么，六字以内"}]}',
    '规矩：做买卖的白天在自家铺子；官吏白天在衙门；家眷在自己宅里；夜里各自回住处。',
    '拿不准的人就不要写，宁缺毋滥。',
  ].join('\n');

  const user = [
    `现在是第${world.clock?.day || 1}日 ${world.clock?.hour || 0}时。`,
    `他们此刻都挤在「${drift.placeName}」：`,
    people,
    '',
    `世上现有的地点：${places}`,
    '',
    '请给上面这些人重新安排位置，输出 JSON。',
  ].join('\n');

  return { system, user };
}

/** 把天道的安排落进世界 */
export function applyPlacements(world, text) {
  const raw = String(text || '');
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { changed: 0, error: '天道没有给出 JSON' };
  let data = null;
  try {
    data = JSON.parse(m[0]);
  } catch {
    return { changed: 0, error: '天神的话不成句（JSON 解析失败）' };
  }
  const list = Array.isArray(data?.placements) ? data.placements : [];
  if (!list.length) return { changed: 0, error: '天道没有安排任何人' };

  const nameToId = new Map();
  for (const [id, p] of Object.entries(world.places || {})) {
    if (p?.name) nameToId.set(String(p.name), id);
  }
  const byName = new Map();
  for (const a of Object.values(world.actors || {})) {
    if (a?.name) byName.set(String(a.name), a);
  }

  let changed = 0;
  const notes = [];
  for (const item of list) {
    const a = byName.get(String(item?.name || ''));
    const placeId = nameToId.get(String(item?.place || ''));
    if (!a || !placeId || a.dead || a.id === 'husband' || a.humanBound) continue;
    if (a.intimacy?.ritual === 'unlocked') continue;
    const moved = a.location !== placeId;
    a.location = placeId;
    if (item.activity) a.activity = { text: String(item.activity).slice(0, 12), day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
    if (moved) changed += 1;
    notes.push(`${a.name}→${item.place}`);
  }
  return { changed, notes };
}

/** 该不该自愈：同一时刻只做一次，且要有明显不对劲 */
export function shouldHeal(world, force = false) {
  if (force) return true;
  const last = Number(world.flags?.lastSelfHealDayHour || 0);
  const nowKey = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
  if (nowKey - last < 3) return false;      // 三小时内不重复问
  return true;
}
