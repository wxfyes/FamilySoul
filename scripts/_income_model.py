import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find('function dailyIncomeOf(world, prop) {')
end = s.find('\n  // 各人的产业各人收', start)
if start < 0 or end < 0:
    raise SystemExit('定位失败')

new_fn = '''function dailyIncomeOf(world, prop) {
  if (prop.status === '筹备中' || prop.status === '歇业') return 0;

  // ── 本金：产业值多少钱（买价优先；老产业按日入估个底）──
  let capital = Number(prop.capital);
  if (!(capital > 0)) {
    const buy = Number(prop.costSilver);
    const est = Number(prop.baseIncome ?? prop.incomePerDay) || 0;
    capital = buy > 0 ? buy : Math.max(100, est * 80);
    prop.capital = Math.round(capital * 100) / 100;
  }

  const city = world.cities?.[prop.city] || Object.values(world.cities || {}).find((c) => c && c.name === prop.city);
  const price = Number(city?.price) || 100;
  const unrest = Number(city?.unrest) || 0;
  const season = String(world.clock?.season || 'spring');
  const keeper = world.actors?.[prop.keeper];
  const trust = Number(keeper?.relations?.husband?.trust ?? 30);
  const staffCount = Number(prop.staff) || 0;
  const curDay = Number(world.clock?.day) || 1;
  const daysOpen = prop.openedDay != null ? Math.max(1, curDay - Number(prop.openedDay) + 1) : 1;

  // ── 日收益率：本金的百分之几（行情基准 2.5%，按各因素上下浮）──
  let rate = 0.025;
  rate *= 0.7 + Math.min(2.0, price / 100) * 0.3;          // 物价与市面景气
  rate *= 1 - Math.min(0.5, unrest / 200);                 // 民心
  if (/茶/.test(String(prop.name || ''))) rate *= season === 'spring' ? 1.3 : season === 'winter' ? 0.85 : 1.05;
  if (/酒/.test(String(prop.name || ''))) rate *= season === 'winter' ? 1.35 : 1.1;
  rate *= 0.85 + Math.min(0.5, trust / 200);               // 掌柜得力（信任 100 → 1.35x）
  if (staffCount > 0) rate *= 1 + Math.min(1.5, staffCount * 0.3); // 人手：每人 +30%，封顶 2.5x
  rate *= 1 + Math.min(0.6, (daysOpen - 1) * 0.02);        // 商誉：老店常客多（封顶 1.6x）

  // 突发商帮大席：流水翻倍暴击（有伙计才接得住）
  let luckyBonus = 1;
  if (Math.random() < 0.12 && staffCount >= 2) {
    luckyBonus = 1.6 + Math.random() * 1.4;
    prop.specialNotice = '两淮盐商连包三日水席/豪客订商茶，进项暴增！';
  } else {
    delete prop.specialNotice;
  }
  rate *= luckyBonus;
  rate *= 0.94 + Math.random() * 0.12;                     // 每日市井自然起伏

  // 收益率封顶：单日不超过本金 12%，不出现离谱通胀
  rate = Math.max(0.01, Math.min(0.12, rate));

  const gain = Math.round(capital * rate * 100) / 100;

  // ── 利润再投资：赚的钱有一部分滚回本金，生意越长越大 ──
  const reinvest = prop.status === '已开张' || prop.status === '正常营业' ? 0.25 : 0;
  if (reinvest > 0) prop.capital = Math.round((capital + gain * reinvest) * 100) / 100;

  prop.incomePerDay = gain;                                 // 显示的就是今日进项
  prop.baseIncome = Number(prop.baseIncome) || gain;        // 仅作历史参考，不再参与计算
  return gain;
}
'''
s = s[:start] + new_fn + s[end:]
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('收入模型已换成 本金×收益率+再投资')
