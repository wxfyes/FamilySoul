import io
# 迁移：给产业补 capital（买价优先，老产业按日入估）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "  // 补偿：测试期之前就开着的产业，一律视同第 1 日开张（写成数据，不靠公式兜底）"
add = """  // 产业本金：买价优先；祖传/老产业按日入估个底（收入模型按本金×收益率算）
  try {
    for (const pr of (world.assets?.properties || [])) {
      if (!pr) continue;
      if (!(Number(pr.capital) > 0)) {
        const buy = Number(pr.costSilver);
        const est = Number(pr.incomePerDay) || 0;
        pr.capital = Math.round((buy > 0 ? buy : Math.max(100, est * 80)) * 100) / 100;
        console.log(`[Prop] ${pr.name} 本金记为 ${pr.capital} 两`);
      }
    }
  } catch { /* 忽略 */ }

""" + anchor
if anchor in s and '本金记为' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 迁移补本金')
