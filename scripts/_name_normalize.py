import io
# ① 迁移：约定里的名字必须是现存的人；能按拼音片段认出来的就改正
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
add = """export function migrateOwnership(world) {
  // 约定的"人"必须是活人：老数据里存过 id/拼音的，一律纠正成现名
  try {
    const byName = new Set(Object.values(world.actors || {}).filter((a) => a?.name).map((a) => a.name));
    for (const ap of world.appointments || []) {
      if (!ap) continue;
      let nm = String(ap.name || '');
      if (ap.actorId && world.actors?.[ap.actorId]?.name) { ap.name = world.actors[ap.actorId].name; continue; }
      if (byName.has(nm)) continue;
      const direct = Object.values(world.actors || {}).find((a) => a?.name === nm);
      if (direct) { ap.name = direct.name; continue; }
      const frag = nm.toLowerCase().replace(/[^a-z]/g, '');
      if (frag.length >= 3) {
        for (const len of [frag.length, 5, 4, 3]) {
          const part = frag.slice(0, len);
          const hit = Object.entries(world.actors || {}).find(([id]) => id.toLowerCase().includes(part));
          if (hit?.[1]?.name) { ap.name = hit[1].name; console.log(`[Name] 约定 ${nm} → ${hit[1].name}`); break; }
        }
      }
    }
  } catch { /* 忽略 */ }"""
if anchor in s and '约定的"人"必须是活人' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('迁移纠正约定的名字')

# ② 显示：认不出来就写"某位"，不写 id
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("              return '不知是谁';", "              return '';")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('无法识别时显示空，不再出现拼音')
