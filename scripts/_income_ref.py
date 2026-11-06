import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
# ① 模块级引用
if 'let __dailyIncomeFn' not in s:
    s = s.replace("/** 产业当日进项：底数", "let __dailyIncomeFn = null;\n\n/** 产业当日进项：底数", 1)
# ② 定义后挂上引用（函数结束的 } 后）
old = """  prop.incomePerDay = gain;                                 // 显示的就是今日进项
  prop.baseIncome = Number(prop.baseIncome) || gain;        // 仅作历史参考，不再参与计算
  return gain;
}"""
new = """  prop.incomePerDay = gain;                                 // 显示的就是今日进项
  prop.baseIncome = Number(prop.baseIncome) || gain;        // 仅作历史参考，不再参与计算
  return gain;
}
__dailyIncomeFn = dailyIncomeOf;"""
if old in s and '__dailyIncomeFn = dailyIncomeOf;' not in s:
    s = s.replace(old, new, 1)
# ③ refresh 用引用
s = s.replace("      const g = dailyIncomeOf(world, p);", "      const g = __dailyIncomeFn ? __dailyIncomeFn(world, p) : 0;", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('用引用暴露日入函数')
