import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 国家尺度：国库按百万两、收支按百倍放大（民间仍旧用两，朝廷用国库两）
old = """  tr.silver = Math.round(((Number(tr.silver) || 0) + income - expense) * 100) / 100;
  tr.lastIncome = Math.round(income * 100) / 100;
  tr.detail = { cityTax: Math.round((income - tradeTax - tariff) * 100) / 100, tradeTax, tariff, tariffCities };"""
new = """  // 国家尺度：朝廷的银库以"国库两"计（民间 1 两 = 国库 100 两）
  const K = 100;
  const grossIncome = Math.round(income * K * 100) / 100;
  const salaryPay = Math.round(expense * K * 100) / 100;

  // 制度性损耗：火耗、漂没、截留、层层盘剥（国库越大、衙门越松，漏得越多）
  const pressure = Number(world.flags?.courtPressure) || 0;
  const skimRate = Math.min(0.35, 0.06 + pressure / 400 + (Number(world.flags?.courtBankrupt) ? 0.05 : 0));
  const skim = Math.round(grossIncome * skimRate * 100) / 100;

  tr.silver = Math.round(((Number(tr.silver) || 0) + grossIncome - skim - salaryPay) * 100) / 100;
  tr.lastIncome = grossIncome;
  tr.lastExpense = Math.round((salaryPay + skim) * 100) / 100;
  tr.detail = {
    cityTax: Math.round((income - tradeTax - tariff) * K * 100) / 100,
    tradeTax: Math.round(tradeTax * K * 100) / 100,
    tariff: Math.round(tariff * K * 100) / 100,
    salary: salaryPay,
    skim,
    skimRate: Math.round(skimRate * 1000) / 1000,
  };"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 国家尺度 + 制度性损耗')
io.open(p, 'w', encoding='utf-8-sig').write(s)
