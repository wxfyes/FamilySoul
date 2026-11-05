import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 关税：只认 port 字段（不再按名字正则）
old = """    const region = String(ct.region || '');
    if (/运河|码头|江南|淮|漕/.test(region + String(ct.name || ''))) tariffCities += 1;"""
new = """    if (ct.port === true) tariffCities += 1;"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 关税只认 port 字段')

# ② 刚性支出：官俸 + 防务 + 河工岁修，让财政紧平衡
old2 = """  const K = 100;
  const grossIncome = Math.round(income * K * 100) / 100;
  const salaryPay = Math.round(expense * K * 100) / 100;"""
new2 = """  const K = 100;
  const grossIncome = Math.round(income * K * 100) / 100;
  const salaryPay = Math.round(expense * K * 100) / 100;

  // 刚性支出（国库两）：防务营兵水师、运河河工与驿传岁修
  const defenseBase = 5500;
  const riverMaintenance = 2800;
  const routineExpense = Math.round((salaryPay + defenseBase + riverMaintenance) * 100) / 100;"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 加防务与河工支出')

# ③ 结余用刚性支出
old3 = """  tr.silver = Math.round(((Number(tr.silver) || 0) + grossIncome - skim - salaryPay) * 100) / 100;
  tr.lastIncome = grossIncome;
  tr.lastExpense = Math.round((salaryPay + skim) * 100) / 100;"""
new3 = """  tr.silver = Math.round(((Number(tr.silver) || 0) + grossIncome - skim - routineExpense) * 100) / 100;
  tr.lastIncome = grossIncome;
  tr.lastExpense = Math.round((routineExpense + skim) * 100) / 100;"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 结余改按刚性支出')

# ④ 明细补防务/河工
old4 = """    salary: salaryPay,
    skim,"""
new4 = """    salary: salaryPay,
    defense: defenseBase,
    river: riverMaintenance,
    skim,"""
if old4 in s:
    s = s.replace(old4, new4, 1)
    print('④ 明细补防务河工')

# ⑤ 官员分银：国库两 → 民间两（除以 K）
old5 = """      const each = Math.round((skim * 0.3 / holders.length) * 100) / 100;
      for (const a of holders) a.money = Math.round(((Number(a.money) || 0) + each) * 100) / 100;
      tr.detail.skimToOfficials = Math.round(each * holders.length * 100) / 100;"""
new5 = """      // 国库两 → 民间两要除以 K，否则九品小官比开酒楼的相公还富
      const each = Math.round(((skim * 0.3 / K) / holders.length) * 100) / 100;
      for (const a of holders) a.money = Math.round(((Number(a.money) || 0) + each) * 100) / 100;
      tr.detail.skimToOfficials = Math.round(skim * 0.3 * 100) / 100;
      tr.detail.skimToOfficialsCivil = Math.round(each * holders.length * 100) / 100;"""
if old5 in s:
    s = s.replace(old5, new5, 1)
    print('⑤ 贪墨换算回民间两')

io.open(p, 'w', encoding='utf-8-sig').write(s)
