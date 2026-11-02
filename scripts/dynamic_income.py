import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 动态日入计算
anchor = "  // 各人的产业各人收：有掌柜归掌柜，没掌柜才进公账"
fn = (
    "/** 产业当日进项：底数 × 行情 × 民心 × 季节 × 掌柜本事（有涨有落，不写死）*/\n"
    "function dailyIncomeOf(world, prop) {\n"
    "  const base = Number(prop.baseIncome ?? prop.incomePerDay) || 0;\n"
    "  if (!(base > 0)) return 0;\n"
    "  if (prop.baseIncome == null) prop.baseIncome = base;\n"
    "  const city = world.cities?.[prop.city] || Object.values(world.cities || {}).find((c) => c && c.name === prop.city);\n"
    "  const price = Number(city?.price) || 100;\n"
    "  const unrest = Number(city?.unrest) || 0;\n"
    "  const season = String(world.clock?.season || 'spring');\n"
    "  const keeper = world.actors?.[prop.keeper];\n"
    "  const trust = Number(keeper?.relations?.husband?.trust ?? 30);\n"
    "  let m = 1;\n"
    "  m *= 0.6 + Math.min(2.2, price / 100) * 0.4;        // 物价高，生意跟着好\n"
    "  m *= 1 - Math.min(0.6, unrest / 160);                // 民心乱，客少\n"
    "  if (/茶/.test(String(prop.name || '')) ) m *= season === 'spring' ? 1.12 : season === 'winter' ? 0.92 : 1;\n"
    "  if (/酒/.test(String(prop.name || '')) ) m *= season === 'winter' ? 1.15 : 1;\n"
    "  m *= 0.9 + Math.min(0.35, trust / 300);              // 掌柜得力\n"
    "  if (Number(prop.staff) > 0) m *= 1 + Math.min(0.25, Number(prop.staff) * 0.03);\n"
    "  m *= 0.92 + Math.random() * 0.16;                    // 每日小波动\n"
    "  const gain = Math.round(base * m * 100) / 100;\n"
    "  prop.incomePerDay = gain;                            // 显示的就是今日进项\n"
    "  return gain;\n"
    "}\n\n"
    "  // 各人的产业各人收：有掌柜归掌柜，没掌柜才进公账"
)
if anchor in s and 'dailyIncomeOf' not in s:
    s = s.replace(anchor, fn, 1)
    print('added dailyIncomeOf')

old2 = "    const gain = Number(p.incomePerDay) || 0;"
new2 = "    const gain = dailyIncomeOf(world, p);"
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: use dynamic income')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
