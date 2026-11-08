/**
 * 街面风评：话是会长腿的。
 *
 * world.rumors = [{ id, text, about:[actorId], tone(-1|0|1), weight, day, reach, heardBy:[actorId] }]
 *
 * 规则：
 *  - 出了事（案子、判决、官府动静、大买卖）→ 生一条风评
 *  - 每天扩散：越"有嚼头"传得越快；传久了会淡
 *  - 传到了谁的耳朵里，谁的态度就跟着动一点
 *  - 说人是非的，多半是同一条街上的人（街坊/同行传得最快）
 */

const GOSSIPS = /(伙计|摊|婆|掌柜|老鸨|屠|铁匠|郎中的|书吏|更夫)/;

function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function addRumor(world, { text, about = [], tone = 0, weight = 3, reach = 0 } = {}) {
  const t = String(text || '').trim().slice(0, 60);
  if (!t) return null;
  world.rumors = Array.isArray(world.rumors) ? world.rumors : [];
  if (world.rumors.some((r) => r.text === t)) return null;
  world.flags = world.flags || {};
  world.flags.rumorSeq = (Number(world.flags.rumorSeq) || 0) + 1;
  const r = {
    id: `rumor_${world.flags.rumorSeq}`,
    text: t,
    about: about.filter(Boolean),
    tone: Math.max(-1, Math.min(1, Number(tone) || 0)),
    weight: Math.max(1, Math.min(10, Number(weight) || 3)),
    day: world.clock?.day || 1,
    reach: Math.max(0, Math.min(60, Number(reach) || 0)),
    heardBy: [],
  };
  world.rumors.push(r);
  if (world.rumors.length > 60) world.rumors = world.rumors.slice(-60);
  return r;
}

/** 每天：扩散 + 衰减 + 听到的人态度微调 */
export function spreadRumors(world) {
  const day = Number(world.clock?.day) || 1;
  const actors = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== 'husband');
  if (!actors.length) return [];
  const events = [];

  for (const r of world.rumors || []) {
    if (!r) continue;
    if (r.weight <= 0) continue;
    r.reach = Math.min(60, (Number(r.reach) || 0) + r.weight);
    // 爱嚼舌根的人传得更快
    const gossips = actors.filter((a) => GOSSIPS.test(String(a.role || '')));
    const speed = 1 + gossips.length * 0.06;
    r.weight = Math.max(0, Math.round((r.weight - 0.4) * 10) / 10) + (speed - 1);

    // 谁听到了：按 reach 覆盖人数（越靠前越可能知道）
    const pool = actors.slice().sort((a, b) => hashId(a.id + r.id) - hashId(b.id + r.id));
    const howMany = Math.min(pool.length, Math.floor(r.reach / 6));
    for (let i = 0; i < howMany; i += 1) {
      const a = pool[i];
      if (!a || r.heardBy.includes(a.id)) continue;
      r.heardBy.push(a.id);
      if (r.tone === 0) continue;
      const rel = a.relations?.husband || { trust: 30, desire: 0, fear: 0, grievance: 0 };
      const target = r.about.includes(a.id) ? r.tone * 2 : r.tone; // 说自己的，反应更大
      rel.trust = Math.max(0, Math.min(100, (Number(rel.trust) || 30) + Math.round(target * 1.5)));
      rel.grievance = Math.max(0, Math.min(100, (Number(rel.grievance) || 0) + Math.round(-target * 1.5)));
      a.relations = a.relations || {};
      a.relations.husband = rel;
      events.push(`${a.name}听说了「${r.text}」`);
    }
    if (r.heardBy.length > 50) r.heardBy = r.heardBy.slice(-50);
  }
  world.rumors = (world.rumors || []).filter((r) => r && (Number(r.weight) > 0 || (day - Number(r.day || day)) < 3));
  return events;
}

/** 谁在场、他可能听过哪些话 → 给对话上下文用 */
export function rumorsKnownBy(world, actorIds) {
  const out = [];
  for (const id of actorIds) {
    for (const r of world.rumors || []) {
      if (!r) continue;
      if (r.about.includes(id)) { out.push(`${world.actors?.[id]?.name}自己的事：${r.text}`); continue; }
      if ((r.heardBy || []).includes(id) && Number(r.weight) >= 1) out.push(`${world.actors?.[id]?.name}听人说过：${r.text}`);
    }
  }
  return Array.from(new Set(out)).slice(0, 6);
}
