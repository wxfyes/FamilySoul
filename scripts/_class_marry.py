import io
p = 'src/world/marriage.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const rel = target.relations?.[suitorId] || {};
  const trust = num(rel.trust);
  const giftNum = num(gift);
  const chance = Math.min(0.95, 0.15 + trust / 100 + Math.min(0.4, giftNum / 20));"""
new = """  const rel = target.relations?.[suitorId] || {};
  const trust = num(rel.trust);
  const giftNum = num(gift);

  // 门第：大户小姐、才女，家里要门当户对——交情与聘礼都得够
  const gentle = /小姐|才女|闺秀|千金/.test(String(target.role || ''));
  if (gentle) {
    const props = (world.assets?.properties || []).filter((x) => x && (String(x.owner || '') === String(suitorId) || String(x.keeper || '') === String(suitorId))).length;
    const fame = Number(world.actors?.[suitorId]?.fame || 0);
    const standing = props >= 1 || fame >= 15;
    if (trust < 40 || giftNum < 20) {
      return { ok: false, line: `（${target.name}家里要门当户对：先与她说得上话（交情${Math.round(trust)}/40），聘礼也不能寒酸（${giftNum.toFixed(0)}/20 两）。）` };
    }
    if (!standing) {
      return { ok: false, line: `（${target.name}的父亲摇了摇头：你家底还薄，先立起一处产业再来提亲。）` };
    }
  }

  const chance = Math.min(0.95, 0.15 + trust / 100 + Math.min(0.4, giftNum / 20));"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('门第规则')
