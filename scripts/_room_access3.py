import io
# ③ 老存档补正：按 use 重算经营场所房间的 access
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      try { refreshTitles(world); } catch { /* 忽略 */ }   // 身份跟着营生变"""
new = """      // 经营场所的房间分级（老存档补正）：前堂可待客，后厨库房后坊只许当差
      try {
        for (const pl of Object.values(world.places || {})) {
          if (!pl || !pl.rooms) continue;
          if (!(pl.use === 'restaurant' || pl.use === 'shop' || pl.use === 'court')) continue;
          for (const rec of Object.values(pl.rooms)) {
            if (!rec) continue;
            const pub = rec.use === 'shop_floor' || rec.use === 'hall';
            rec.access = pub ? 'public_shop' : 'staff_only';
            const rp = world.places?.[rec.id];
            if (rp) { rp.access = rec.access; rp.use = rec.use; }
          }
        }
      } catch { /* 忽略 */ }
      try { refreshTitles(world); } catch { /* 忽略 */ }   // 身份跟着营生变"""
if old in s and '老存档补正' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 巡检补正房间分级')
