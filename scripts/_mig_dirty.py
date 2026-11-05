import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① loadState：迁移改动过就落盘一次
old = """export function loadState(dataDir) {
  const __w = __loadStateInner(dataDir);
  return migrateOwnership(__w);
}"""
new = """export function loadState(dataDir) {
  const __w = __loadStateInner(dataDir);
  const out = migrateOwnership(__w);
  // 迁移真的改过东西才写盘，避免每次读档都白写一遍
  if (out && out.__migratedDirty) {
    delete out.__migratedDirty;
    try { saveState(dataDir, out); } catch { /* 忽略 */ }
  }
  return out;
}"""
if old in s:
    s = s.replace(old, new, 1)
    print('① loadState 迁移后落盘')

# ② 各处记录 dirty
s = s.replace("""    const n = pruneForeignRooms(world);
    if (n) console.log(`[Spaces] 清掉 ${n} 间串模板的房间`);""",
"""    const n = pruneForeignRooms(world);
    if (n) { console.log(`[Spaces] 清掉 ${n} 间串模板的房间`); world.__migratedDirty = true; }""")

s = s.replace("""    const n = settleItinerants(world);
    if (n) console.log(`[Residence] 把 ${n} 个流动小贩请回街市`);""",
"""    const n = settleItinerants(world);
    if (n) { console.log(`[Residence] 把 ${n} 个流动小贩请回街市`); world.__migratedDirty = true; }""")

s = s.replace("""    const n = buildCourts(world);
    if (n) console.log(`[Court] 建出 ${n} 间衙署房舍`);""",
"""    const n = buildCourts(world);
    if (n) { console.log(`[Court] 建出 ${n} 间衙署房舍`); world.__migratedDirty = true; }""")

s = s.replace("""    const n = buildPremises(world);
    if (n) console.log(`[Premises] 建出 ${n} 间经营空间`);""",
"""    const n = buildPremises(world);
    if (n) { console.log(`[Premises] 建出 ${n} 间经营空间`); world.__migratedDirty = true; }""")

s = s.replace("""      if (p && p.rooms) { upgradeResidence(world, pid); relinkResidence(world, pid); }""",
"""      if (p && p.rooms) {
        const up = upgradeResidence(world, pid);
        relinkResidence(world, pid);
        if (up) world.__migratedDirty = true;
      }""")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('② 记录 dirty')
