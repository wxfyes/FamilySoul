import io
# 迁移：把城的税率落成数据（没有 tax 的补 10，已有的保留，含 0）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "  // 产业本金：买价优先；祖传/老产业按日入估个底（收入模型按本金×收益率算）"
add = """  // 税率落成数据：没写过的补 10%，写过 0 的就是免税（0 不再被当成缺省）
  try {
    for (const ct of Object.values(world.cities || {})) {
      if (!ct) continue;
      if (!Number.isFinite(Number(ct.tax))) ct.tax = 10;
    }
  } catch { /* 忽略 */ }

""" + anchor
if anchor in s and '税率落成数据' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('迁移补税率数据')
