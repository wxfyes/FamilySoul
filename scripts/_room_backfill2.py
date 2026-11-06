import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find("      // 经营场所的房间分级（老存档补正）")
end = s.find("      try { refreshTitles(world); }", start)
if start > 0 and end > 0:
    new = """      // 房间分级补正（老存档）：按这间房"是干什么用的"重定门第，前堂可待客，其余止步
      try {
        const gradeOf = (use) => {
          const u = String(use || '');
          if (u === 'shop_floor' || u === 'hall' || u === 'gate' || u === 'yard') return 'public_shop';
          if (u === 'bedroom') return 'family_inner';
          if (u === 'kitchen' || u === 'store' || u === 'workshop') return 'staff_only';
          return 'staff_only';
        };
        const junk = [];
        for (const [pid, pl] of Object.entries(world.places || {})) {
          if (!pl) continue;
          // 房间的房间（父地点本身也是房间）——是早先误建的，清掉
          const par = pl.parent ? world.places?.[pl.parent] : null;
          if (par && par.parent) { junk.push(pid); continue; }
          if (pl.rooms) {
            for (const rec of Object.values(pl.rooms)) {
              if (!rec) continue;
              rec.access = gradeOf(rec.use);
              const rp = world.places?.[rec.id];
              if (rp) { rp.access = rec.access; rp.use = rec.use; }
            }
          } else if (pl.parent && !pl.residence) {
            pl.access = gradeOf(pl.use);
          }
        }
        for (const j of junk) { delete world.places[j]; }
        if (junk.length) console.log(`[Spaces] 清掉 ${junk.length} 处"房间里的房间"`);
      } catch { /* 忽略 */ }
"""
    s = s[:start] + new + s[end:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 房间分级补正 + 清嵌套房')
