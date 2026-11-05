import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function pruneRunawayRooms' not in s:
    s = s.replace("export function buildAllResidences(world) {", """/**
 * 清掉"房间里又长出来的房间"（id 里带两层 __），并把账上指向不存在地点的院子删掉。
 * 这是给一次事故擦屁股用的规则，不是特判：两层以上的一律不认。
 */
export function pruneRunawayRooms(world) {
  let removed = 0;
  for (const pid of Object.keys(world?.places || {})) {
    if ((String(pid).match(/__/g) || []).length >= 2) {
      delete world.places[pid];
      removed += 1;
    }
  }
  // 账上记着、世界里没有的院子，一并清掉
  for (const p of Object.values(world?.places || {})) {
    if (!p?.rooms) continue;
    for (const [k, r] of Object.entries(p.rooms)) {
      if (!r || !r.id || !world.places[r.id]) { delete p.rooms[k]; removed += 1; }
    }
  }
  return removed;
}

export function buildAllResidences(world) {""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加 pruneRunawayRooms')

p2 = 'src/world/residence.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("""  // 安全阀：地点已经多到不正常，就先不建了，免得把进程拖死""",
"""  pruneRunawayRooms(world);

  // 安全阀：地点已经多到不正常，就先不建了，免得把进程拖死""")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('巡检前先擦屁股')
