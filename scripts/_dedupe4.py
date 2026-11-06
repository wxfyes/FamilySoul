import io
p = 'src/world/state.js'
t = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：仍有重名（含撞名再撞名）——加辈字改正"
add = """      // 一次性：官场人物（off_/county_）重名，同样加辈字改正
      try {
        if (!world.flags?.nameDedupeV4) {
          const keep = new Set();
          const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);
          all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
          const renamed = [];
          for (const a of all) {
            if (!keep.has(a.name)) { keep.add(a.name); continue; }
            if (!/^off_|^county_/.test(String(a.id))) continue;
            const base = a.name;
            const suf = ['二', '三', '四', '五'];
            let nm = base;
            for (let i = 0; i < suf.length && keep.has(nm); i += 1) nm = base + suf[i];
            if (keep.has(nm)) continue;
            renamed.push(`${base}→${nm}`);
            a.name = nm;
            keep.add(nm);
          }
          world.flags = world.flags || {};
          world.flags.nameDedupeV4 = { at: Date.now(), renamed: renamed.length };
          if (renamed.length) console.log(`[Name] 官员重名改正 ${renamed.length} 人：${renamed.join('、')}`);
        }
      } catch { /* 忽略 */ }

"""
if 'nameDedupeV4' not in t and anchor in t:
    t = t.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(t)
    print('V4 迁移')
