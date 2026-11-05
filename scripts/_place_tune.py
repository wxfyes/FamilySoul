import io
p = 'src/world/places-target.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 评分：名字里含原话关键词的优先
old = """function score(p, nearId, actor) {
  let s = 0;"""
new = """function score(p, nearId, actor, hint = '') {
  let s = 0;
  if (hint && p.name && String(p.name).includes(hint)) s += 6;"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 原话匹配加分')

# ② 室内去处（房/厢/院/阁/厨/库）：回自家宅院里，而不是被赶到街上
old2 = """  // ③ 兜底：街市 → 他自己家 → 任何非私宅"""
new2 = """  // ②.5 室内去处：在自己的宅院里找（厢房/下房/花园/庖厨），找不到就回自己家
  if (/房|厢|院|阁|厨|库|屋/.test(text)) {
    const homePlace = actor?.home ? world.places?.[actor.home] : null;
    const mansionKey = homePlace?.name ? String(homePlace.name).split('·').find((x) => /宅|府|院/.test(x)) || '' : '';
    const inside = places.filter((p) => p.name && /房|厢|院|阁|厨|库|屋/.test(String(p.name))
      && (p.residence || (mansionKey && String(p.name).includes(mansionKey))));
    if (inside.length) {
      inside.sort((a, b) => score(b, nearId, actor, text) - score(a, nearId, actor, text));
      return inside[0].id;
    }
    if (actor?.home && world.places?.[actor.home]) return actor.home;
  }

  // ③ 兜底：街市 → 他自己家 → 任何非私宅"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 室内去处收在宅内')

# ③ 调用处补 hint
s = s.replace("const byName = places\n    .filter((p) => p.name && text.includes(String(p.name).slice(0, 3)))\n    .sort((a, b) => score(b, nearId, actor) - score(a, nearId, actor));",
              "const byName = places\n    .filter((p) => p.name && text.includes(String(p.name).slice(0, 3)))\n    .sort((a, b) => score(b, nearId, actor, text) - score(a, nearId, actor, text));")
s = s.replace("cands.sort((a, b) => score(b, nearId, actor) - score(a, nearId, actor));",
              "cands.sort((a, b) => score(b, nearId, actor, text) - score(a, nearId, actor, text));")
io.open(p, 'w', encoding='utf-8-sig').write(s)
