/**
 * 夫妻关系：由"角色描述 + 同住一处"推出来，写进 actor.spouse，成为唯一事实源。
 *
 * 规则（按类别，不按人名）：
 *   ① 角色里写明「某人的丈夫/夫君」，或「某人的发妻/娘子」→ 直接结对；
 *   ② 角色里自称「发妻/妻子/娘子/内人」的人，若与同住的成年男子恰好只有一位 → 结为夫妻；
 *   ③ 姻亲关系写回双方 spouse，代演与提示词都读这一个字段。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const HUSBAND_WORD = /(的)?(正牌|明媒正娶的|结发)?(丈夫|夫君|官人)/;
const WIFE_WORD = /(发妻|妻子|娘子|内人|拙荆|媳妇)/;

/** 名字出现在角色描述里（按名字长度降序匹配，避免"王二"吃掉"王二郎"） */
function nameMentioned(text, names) {
  const sorted = names.slice().sort((a, b) => b.length - a.length);
  for (const n of sorted) {
    if (n && n.length >= 2 && text.includes(n)) return n;
  }
  return '';
}

/**
 * 一次性：把夫妻关系补进 actor.spouse
 * @returns {Array<[string,string]>} 新结成的对子（名字）
 */
export function linkCouples(world) {
  const actors = Object.values(world.actors || {}).filter((a) => a && !a.dead);
  const byName = new Map(actors.map((a) => [a.name, a]));
  const names = actors.map((a) => a.name).filter(Boolean);
  const linked = [];
  const idSet = new Set(actors.map((a) => a.id));

  // 先修：配偶指向不存在的人（旧数据里的"战静"之类），先清空再重新配
  for (const a of actors) {
    if (a.spouse && !idSet.has(a.spouse)) {
      a.spouse = null;
    }
  }

  const pair = (a, b) => {
    if (!a || !b || a.id === b.id) return;
    if (a.spouse && a.spouse !== b.id) return;
    if (b.spouse && b.spouse !== a.id) return;
    if (a.spouse === b.id && b.spouse === a.id) return;
    a.spouse = b.id;
    b.spouse = a.id;
    linked.push([a.name, b.name]);
  };

  // ① 角色描述里点名
  for (const a of actors) {
    const text = String(a.role || '');
    if (!text) continue;
    const other = nameMentioned(text, names.filter((n) => n !== a.name));
    if (!other) continue;
    const b = byName.get(other);
    if (!b) continue;
    if (HUSBAND_WORD.test(text) || WIFE_WORD.test(text)) pair(a, b);
  }

  // ② 自称"发妻/娘子"且同住一处，且同住的成年异性只有一位
  for (const a of actors) {
    if (a.spouse) continue;
    const text = String(a.role || '');
    if (!WIFE_WORD.test(text)) continue;
    if (!HUSBAND_WORD.test(text) && !/(发妻|妻子|娘子|内人|拙荆)/.test(text)) continue;
    const mates = actors.filter((b) => b && b.id !== a.id && !b.spouse && b.home && b.home === a.home && b.gender && b.gender !== a.gender && num(b.age) >= 16);
    if (mates.length !== 1) continue;
    pair(a, mates[0]);
  }

  // ③ 反过来：男方角色写"某人的丈夫"但上面没连上（名字带称谓后缀）
  for (const a of actors) {
    if (a.spouse) continue;
    if (!HUSBAND_WORD.test(String(a.role || ''))) continue;
    const mates = actors.filter((b) => b && b.id !== a.id && !b.spouse && b.home && b.home === a.home && b.gender && b.gender !== a.gender && num(b.age) >= 16);
    if (mates.length !== 1) continue;
    pair(a, mates[0]);
  }

  return linked;
}
