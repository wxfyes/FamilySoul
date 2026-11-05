import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  // 税率落成数据：没写过的补 10%，写过 0 的就是免税（0 不再被当成缺省）
  try {
    for (const ct of Object.values(world.cities || {})) {
      if (!ct) continue;
      if (!Number.isFinite(Number(ct.tax))) ct.tax = 10;
    }
  } catch { /* 忽略 */ }"""
new = """  // 税率落成数据：没写过的补 10%；历史上被 `|| 10` 暗中按 10% 收税的城，一次性明确为 10%
  // （只做一次，之后 0 就是真的免税，不再回填）
  try {
    world.flags = world.flags || {};
    if (!world.flags.taxBackfillDone) {
      let filled = 0;
      for (const ct of Object.values(world.cities || {})) {
        if (!ct) continue;
        const t = Number(ct.tax);
        if (!Number.isFinite(t) || t === 0) { ct.tax = 10; filled += 1; }
      }
      world.flags.taxBackfillDone = { day: world.clock?.day || 1, filled };
      if (filled) console.log(`[Tax] 一次性矫正 ${filled} 座城的税率 → 10%（此前被 || 10 暗中征收）`);
    }
  } catch { /* 忽略 */ }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('改一次性数据矫正')
