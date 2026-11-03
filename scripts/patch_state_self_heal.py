with open('src/world/state.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    milestones: Array.isArray(raw.milestones) ? raw.milestones : base.milestones,
    flags: { ...base.flags, ...(raw.flags || {}) },
  };
}'''

replacement = '''    milestones: Array.isArray(raw.milestones) ? raw.milestones : base.milestones,
    flags: { ...base.flags, ...(raw.flags || {}) },
  };

  // ── 自愈：将分裂的动态子场所归并回主建筑（解决县衙后堂/长街分裂导致的幽灵隔离死锁）──
  try {
    const places = world.places || {};
    const actors = world.actors || {};
    for (const [pid, p] of Object.entries(places)) {
      if (!p || pid === 'yamen' || pid === 'street' || pid === 'tea_house' || pid === 'jiusi' || pid === 'restaurant' || pid === 'jail_male' || pid === 'jail_female') continue;
      const nm = String(p.name || '');
      let targetPid = null;
      if (/(县衙|后堂|县衙后堂|后院|偏厅)/.test(nm) && !/(牢|狱)/.test(nm) && places.yamen) targetPid = 'yamen';
      else if (/(长街|青石板|大街)/.test(nm) && places.street) targetPid = 'street';
      else if (/(茶坊|茶楼)/.test(nm) && places.tea_house) targetPid = 'tea_house';
      else if (/(酒楼)/.test(nm) && places.restaurant) targetPid = 'restaurant';
      else if (/(酒肆)/.test(nm) && places.jiusi) targetPid = 'jiusi';

      if (targetPid && targetPid !== pid) {
        for (const [aid, act] of Object.entries(actors)) {
          if (act && act.location === pid) act.location = targetPid;
          if (act && act.home === pid) act.home = targetPid;
        }
        delete places[pid];
      }
    }
  } catch {}

  return world;
}'''

# 检查 target
target_find = 'flags: { ...base.flags, ...(raw.flags || {}) },\n  };\n}'
if target_find in text:
    # 替换为 const world = { ... }; 然后自愈后 return world;
    # 找 const world 对应结构
    pass

# 更直接的替换：找到 return { ... flags: ... }; }
# 将 return { 改为 const resWorld = {
# 并在结尾 return resWorld
print("Analyzing state.js return structure...")

