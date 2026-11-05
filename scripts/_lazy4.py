import io

# ⑤ places-target：能匹配到"账上的房间"就展开成地点
p = 'src/world/places-target.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'materializeRoom' not in s:
    s = s.replace("const SEMANTICS = [", "import { materializeRoom } from './residence.js';\n\nconst SEMANTICS = [", 1)
    old = """  // ③ 兜底：街市 → 他自己家 → 任何非私宅"""
    new = """  // ②.7 房间在"账"上还没展开：按名字找到就展开
  try {
    for (const [pid, pl] of Object.entries(world?.places || {})) {
      if (!pl || !pl.rooms) continue;
      for (const [key, rec] of Object.entries(pl.rooms)) {
        if (!rec || !rec.name) continue;
        if (!text.includes(rec.name) && !text.includes(String(rec.name).slice(0, 2))) continue;
        const made = materializeRoom(world, pid, key);
        if (made) { console.log(`[Room] 展开 ${pl.name}·${rec.name}`); return made; }
      }
    }
  } catch { /* 忽略 */ }

  // ③ 兜底：街市 → 他自己家 → 任何非私宅"""
    if old in s:
        s = s.replace(old, new, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('⑤ places-target 按需展开房间')

# ⑥ apply.js：目标 id 是房间但没展开 → 展开它
p2 = 'src/world/apply.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'materializeRoom' not in t:
    t = t.replace("import { resolvePlaceTarget } from './places-target.js';",
                  "import { resolvePlaceTarget } from './places-target.js';\nimport { materializeRoom } from './residence.js';")
    old2 = """      if (!finalTargetId) {
        const found = Object.entries(world.places).find"""
    new2 = """      // 目标是"某宅·某院"这种还没展开的房间 → 先展开
      if (!finalTargetId && String(targetPlaceName).includes('__')) {
        const [parentId, key] = String(targetPlaceName).split('__');
        const made = materializeRoom(world, parentId, key);
        if (made) finalTargetId = made;
      }
      if (!finalTargetId) {
        const found = Object.entries(world.places).find"""
    if old2 in t:
        t = t.replace(old2, new2, 1)
        io.open(p2, 'w', encoding='utf-8-sig').write(t)
        print('⑥ apply 支持展开房间')
