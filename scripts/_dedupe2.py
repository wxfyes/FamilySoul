import io
# ② 全局重名迁移：同名只留一个（优先真人/原住/早生），其余改名
p = 'src/world/state.js'
t = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：阶级人物被误标成\"相公府里人\""
add = """      // 一次性：全服重名改正（同名只留一个，其余换世界姓名池里的名字，id 不动）
      try {
        if (!world.flags?.nameDedupeV2) {
          const keep = new Set();
          const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);
          all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
          const renamed = [];
          for (const a of all) {
            if (!keep.has(a.name)) { keep.add(a.name); continue; }
            if (a.id === 'husband' || String(a.id).startsWith('usr_')) continue;
            let nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            for (let i = 0; i < 12 && nm && keep.has(nm); i += 1) nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            if (!nm) continue;
            renamed.push(`${a.name}→${nm}`);
            a.name = nm;
            keep.add(nm);
          }
          world.flags = world.flags || {};
          world.flags.nameDedupeV2 = { at: Date.now(), renamed: renamed.length };
          if (renamed.length) console.log(`[Name] 全服重名改正 ${renamed.length} 人：${renamed.slice(0, 8).join('、')}…`);
        }
      } catch { /* 忽略 */ }

"""
if 'nameDedupeV2' not in t and anchor in t:
    t = t.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(t)
    print('② 全局重名迁移')
