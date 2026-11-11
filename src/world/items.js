/**
 * 物品账本：每件东西有编号、有类别、有持有者。
 *
 * 规矩：
 *   ① 物品不在谁手里，就不能给；
 *   ② 给/要/出示都走这里，单一写者；
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
  const nm = String(name || '').trim().slice(0, 24);
  if (!nm) return null;
  world.flags.itemSeq += 1;
  const id = `item_${world.flags.itemSeq}`;
  world.items[id] = {
    id, name: nm, kind: String(kind || '杂物').slice(0, 10),
    holder: String(holder || 'husband'), from: '', day: num(world.clock?.day) || 1,
    note: String(note || '').slice(0, 50),
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

  // 增进羁绊与好感
  let trustDelta = 0;
  let desireDelta = 0;
  if (fromId === 'husband') {
    to.relations = to.relations || {};
    to.relations.husband = to.relations.husband || { trust: 20, desire: 10, grievance: 0 };
    const r = to.relations.husband;
    trustDelta = /契|银|珠|宝|玉|金|首饰|金钗|簪|玉镯/.test(it.name + it.kind) ? 8 : 4;
    desireDelta = to.gender === 'female' ? (/珠|宝|玉|金|首饰|金钗|簪|玉镯|绫罗/.test(it.name + it.kind) ? 6 : 3) : 0;
    r.trust = Math.min(100, (Number(r.trust) || 0) + trustDelta);
    r.desire = Math.min(100, (Number(r.desire) || 0) + desireDelta);
  }

  const fromName = world.actors?.[fromId]?.name || (fromId === 'husband' ? '相公' : fromId);
  console.log(`[Item] ${fromName} → ${to.name}：${it.name}`);
  return {
    ok: true,
    line: `（已把《${it.name}》赠予${to.name}。${trustDelta > 0 ? `对方信任+${trustDelta}，心意更深。` : ''}）`,
    item: it,
    trustDelta,
    desireDelta,
  };
}

/** 出示：随身拿着展示验看，不改变持有者 */
export function showItem(world, holderId, toId, itemId) {
  ensureItems(world);
  const it = world.items[itemId];
  if (!it) return { ok: false, line: '（没有这件东西。）' };
  if (it.holder !== String(holderId)) return { ok: false, line: `（这件东西不在手里。）` };
  const to = toId ? world.actors?.[toId] : null;
  const holderName = world.actors?.[holderId]?.name || (holderId === 'husband' ? '相公' : holderId);
  const toName = to?.name || '众人';
  return {
    ok: true,
    line: `（${holderName}自袖中取出一纸《${it.name}》，平摊在案前让${toName}当面勘验。）`,
    item: it,
  };
}

/** 索取：向在场某人讨要/取回东西 */
export function askItem(world, fromId, targetActorId, itemId) {
  ensureItems(world);
  const it = world.items[itemId];
  if (!it) return { ok: false, line: '（查无此物。）' };
  if (it.holder !== String(targetActorId)) return { ok: false, line: '（此物不在对方随身行囊中。）' };
  const target = world.actors?.[targetActorId];
  if (!target) return { ok: false, line: '（没有这个人。）' };

  const r = target.relations?.husband || {};
  const trust = Number(r.trust) || 0;
  const isDoc = /契|引|文|信|公文|卷宗/.test(it.name + it.kind);
  const isFamily = Boolean(target.household);
  const isLove = Boolean(target.intimacy?.consummated) || String(target.bondsWithHusband || '') === '相好' || Number(r.intimate) === 1;

  // 判定是否允许索取
  if (!isFamily && !isLove && !isDoc && trust < 40) {
    return {
      ok: false,
      refused: true,
      line: `（${target.name}下意识将《${it.name}》掩入袖口，面露难色：“相公休要说笑，此物事关体大，恕难从命。”）`,
    };
  }

  // 移交给索要者
  it.holder = String(fromId);
  it.from = String(targetActorId);
  it.givenDay = num(world.clock?.day) || 1;
  const receiverName = world.actors?.[fromId]?.name || (fromId === 'husband' ? '相公' : fromId);
  return {
    ok: true,
    line: `（${target.name}顺从地将《${it.name}》双手奉上，收入${receiverName}行囊。）`,
    item: it,
  };
}

