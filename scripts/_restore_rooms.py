import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { evictOutsiders } from './privacy.js';",
              "import { evictOutsiders } from './privacy.js';\nimport { ensureResidence } from './residence.js';", 1)
old = """      // 房间分级补正（老存档）"""
new = """      // 宅子的房间账被清空过（只剩门）：按等第把院子补回来，否则人会"无处可去"
      try {
        for (const [pid, pl] of Object.entries(world.places || {})) {
          if (!pl || !pl.residence) continue;
          const n = Object.keys(pl.rooms || {}).length;
          if (n >= 5) continue;
          ensureResidence(world, pid, { grade: Number(pl.grade) || 7, ownerId: pl.owner || null });
          console.log(`[Spaces] 补齐宅院房间账：${pl.name || pid}（原 ${n} 间）`);
        }
      } catch { /* 忽略 */ }

      // 房间分级补正（老存档）"""
if old in s and '补齐宅院房间账' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('巡检补宅院房间')
