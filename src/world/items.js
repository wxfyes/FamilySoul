/**
 * 物品账本：每件东西有编号、有类别、有持有者。
 *
 * 规矩：
 *   ① 物品不在谁手里，就不能给；
 *   ② 给/要都走这里，模型只提议；
 *   ③ 一件东西一个编号，同名的是两件。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function ensureItems(world) {
  world.items = world.items && typeof world.items === 'object' ? world.items : {};
  world.flags = world.flags || {};
  world.flags.itemSeq = num(world.flags.itemSeq);
  return world.items;
}

export function addItem(world, { name, kind = '杂物', holder = 'husband', note = '' } = {}) {
  ensureItems(world);
  const nm = String(name || '').trim().slice(0, 20);
  if (!nm) return null;
  world.flags.itemSeq += 1;
  const id = `item_${world.flags.itemSeq}`;
  world.items[id] = {
    id, name: nm, kind: String(kind || '杂物').slice(0, 8),
    holder: String(holder || 'husband'), from: '', day: num(world.clock?.day) || 1,
    note: String(note || '').slice(0, 40),
  };
  return world.items[id];
}

export function itemsOf(world, holderId) {
  ensureItems(world);
  return Object.values(world.items).filter((it) => it && it.holder === String(holderId));
}

/** 按话里的词找一件东西（名字或类别命中） */
export function findItem(world, holderId, words) {
  const list = itemsOf(world, holderId);
  const w = String(words || '').trim();
  if (!w) return null;
  return list.find((it) => w.includes(it.name) || it.name.includes(w) || w.includes(it.kind) || it.kind.includes(w)) || null;
}

/** 给：只能给自己手里的东西 */
export function giveItem(world, fromId, toId, itemId) {
  ensureItems(world);
  const it = world.items[itemId];
  if (!it) return { ok: false, line: '（没有这件东西。）' };
  if (it.holder !== String(fromId)) return { ok: false, line: `（这件东西不在${world.actors?.[fromId]?.name || '你'}手里。）` };
  const to = world.actors?.[toId];
  if (!to) return { ok: false, line: '（没有这个人。）' };
  it.holder = String(toId);
  it.from = String(fromId);
  it.givenDay = num(world.clock?.day) || 1;
  console.log(`[Item] ${world.actors?.[fromId]?.name || fromId} → ${to.name}：${it.name}`);
  return { ok: true, line: `（已把《${it.name}》递给${to.name}。）`, item: it };
}
