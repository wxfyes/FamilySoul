import io
p = 'src/world/state.js'
t = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：全服重名改正"
add = """      // 一次性：仍有重名（含撞名再撞名）——加辈字改正
      try {
        if (!world.flags?.nameDedupeV3) {
          const keep = new Set();
          const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);
          all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
          const renamed = [];
          for (const a of all) {
            if (!keep.has(a.name)) { keep.add(a.name); continue; }
            if (a.id === 'husband' || String(a.id).startsWith('usr_')) continue;
            const base = a.name;
            let n = 0;
            let nm = base;
            const suf = ['二', '三', '四', '五', '六', '七', '八', '九', '十'];
            while (keep.has(nm) && n < suf.length) { nm = base + suf[n]; n += 1; }
            if (keep.has(nm)) continue;
            renamed.push(`${base}→${nm}`);
            a.name = nm;
            keep.add(nm);
          }
          world.flags = world.flags || {};
          world.flags.nameDedupeV3 = { at: Date.now(), renamed: renamed.length };
          if (renamed.length) console.log(`[Name] 残留重名改正 ${renamed.length} 人：${renamed.slice(0, 8).join('、')}`);
        }
      } catch { /* 忽略 */ }

"""
if 'nameDedupeV3' not in t and anchor in t:
    t = t.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(t)
    print('V3 迁移')
