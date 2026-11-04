/**
 * 姓名：名字是标签，身份证（id）才是人。
 *
 * 以前改名是在所有文本里做字符串替换——那是补丁：
 *   · 会误伤（"采云"两个字在别处出现也被替换）
 *   · 历史被篡改（昨天发生的事被改成今天的名字）
 *   · 漏一处就"认不出人"
 *
 * 现在的规矩：
 *   ① 只改这个人的 name 字段，并记进 nameHistory（谁什么时候改的）
 *   ② 所有"按 id 存的派生字段"（约定、差事、产业掌柜、引文署名）重新对齐
 *   ③ 历史文本（事件流、回忆、旧引文）保持原样——那时候他就叫那个名字
 */

export function renameActor(world, actorId, newName, { by = 'husband' } = {}) {
  const a = world?.actors?.[actorId];
  const nm = String(newName || '').trim().slice(0, 12);
  if (!a) return { ok: false, error: '没有这个人' };
  if (!nm) return { ok: false, error: '名字不能为空' };
  if (nm === a.name) return { ok: true, changed: false };

  const oldName = a.name;
  a.nameHistory = Array.isArray(a.nameHistory) ? a.nameHistory : [];
  a.nameHistory.push({ from: oldName, to: nm, by, day: world.clock?.day || 1, hour: world.clock?.hour || 0 });
  a.name = nm;

  // 派生字段按 id 对齐
  let touched = 0;
  for (const ap of world.appointments || []) {
    if (ap && ap.actorId === actorId) { ap.name = nm; touched += 1; }
  }
  for (const t of world.tasks || []) {
    if (t && t.actorId === actorId) { t.name = nm; touched += 1; }
  }
  for (const q of world.quotes || []) {
    if (q && q.actor === actorId) { q.name = nm; touched += 1; }
  }
  for (const prop of world.assets?.properties || []) {
    if (prop && prop.keeper === actorId) { prop.keeperName = nm; touched += 1; }
    if (prop && prop.owner === actorId) { prop.ownerName = nm; touched += 1; }
  }
  for (const inv of world.invites || []) {
    if (!inv) continue;
    if (inv.to === actorId) inv.toName = nm;
    if (inv.from === actorId) inv.fromName = nm;
  }

  world.notes = Array.isArray(world.notes) ? world.notes : [];
  world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${oldName}改名为${nm}` });

  return { ok: true, changed: true, from: oldName, to: nm, touched };
}

/** 按 id 把派生字段里的名字统一刷一遍（迁移/修数时用） */
export function syncNames(world) {
  let fixed = 0;
  const nameOf = (id) => world.actors?.[id]?.name;
  for (const ap of world.appointments || []) {
    const n = ap?.actorId ? nameOf(ap.actorId) : null;
    if (n && ap.name !== n) { ap.name = n; fixed += 1; }
  }
  for (const t of world.tasks || []) {
    const n = t?.actorId ? nameOf(t.actorId) : null;
    if (n && t.name !== n) { t.name = n; fixed += 1; }
  }
  for (const q of world.quotes || []) {
    const n = q?.actor ? nameOf(q.actor) : null;
    if (n && q.name !== n) { q.name = n; fixed += 1; }
  }
  for (const prop of world.assets?.properties || []) {
    const kn = prop?.keeper ? nameOf(prop.keeper) : null;
    if (kn && prop.keeperName !== kn) { prop.keeperName = kn; fixed += 1; }
  }
  return fixed;
}
