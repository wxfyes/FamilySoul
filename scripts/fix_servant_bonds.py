import io

# ① bonds.js：主仆只在"宅内"，且不跨大群
p = 'src/world/bonds.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """    // 主仆
    for (const s of servants) {
      for (const m of masters) addBond(world, s.id, m.id, '主仆', 35);
    }"""
new = """    // 主仆：只连"同宅的主家"（household），且宅内人多半是街上凑一起的，跳过
    if (group.length <= 12) {
      const houseMasters = masters.filter((a) => a.household);
      for (const s of servants) {
        if (!s.household) continue;      // 街上的小厮不算谁家的仆
        for (const m of houseMasters) addBond(world, s.id, m.id, '主仆', 35);
      }
    }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 主仆限定宅内')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 迁移：清掉已有的错误主仆边
p2 = 'src/world/state.js'
d = io.open(p2, encoding='utf-8-sig').read()

mig = """export function migrateOwnership(world) {
  // 清掉错误的主仆关系：对方不是同宅主家的，一律断开
  try {
    let removed = 0;
    for (const [aId, m] of Object.entries(world.bonds || {})) {
      const a = world.actors?.[aId];
      if (!a || !m) continue;
      for (const [bId, b] of Object.entries(m)) {
        if (!b || b.type !== '主仆') continue;
        const other = world.actors?.[bId];
        const ok = a?.household && (other?.household || other?.id === 'husband');
        if (!ok) {
          delete m[bId];
          const back = world.bonds?.[bId];
          if (back) delete back[aId];
          removed += 1;
        }
      }
    }
    if (removed) console.log(`[Bonds] 清理错误主仆关系 ${removed} 条`);
  } catch { /* 忽略 */ }"""
anchor = "export function migrateOwnership(world) {"
if anchor in d and '清理错误主仆关系' not in d:
    d = d.replace(anchor, mig, 1)
    print('② 加入主仆清理迁移')
io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
