import io
# 差事工钱：每日结算（tick 里跨日时发）
p = 'src/world/tick.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  // ── ④ 身份标签随日子变 + 街头摊子按点来去 ──"""
new = """  // ── ③.7 差事工钱：跨日发饷（外城也一样）──
  try {
    if (h === 6) {   // 每天卯时发前一日的工钱
      for (const a of Object.values(world?.actors || {})) {
        if (!a || a.dead || !a.job) continue;
        const pay = Number(a.job.pay) || 0;
        if (pay <= 0) continue;
        if (String(a.id) === 'husband') world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + pay) * 100) / 100;
        else a.money = Math.round(((Number(a.money) || 0) + pay) * 100) / 100;
        a.job.lastPaidDay = day;
        console.log(`[Job] 发工钱：${a.name} +${pay.toFixed(2)} 两（${a.job.title}）`);
      }
    }
  } catch { /* 忽略 */ }

  // ── ④ 身份标签随日子变 + 街头摊子按点来去 ──"""
if old in s and '发工钱' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加日结工钱')
