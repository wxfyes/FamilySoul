import io

p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 按兵种分饷（明代土兵 0.9 两、南兵 1.5 两；清代绿营步战 1.5、守兵 1）
s = s.replace("""export const RECRUIT_KINDS = {
  guard: { name: '家丁', cost: 0.2, grain: 0.2, morale: 0, note: '看家护院' },
  retainer: { name: '护院', cost: 0.5, grain: 0.3, morale: 1, note: '精壮护院' },
  army: { name: '营兵', cost: 0.8, grain: 0.4, morale: 2, note: '能出征的营兵' },
};""",
"""export const RECRUIT_KINDS = {
  // 月饷参考：明万历山东土兵 0.9 两、南兵 1.5 两；清绿营守兵 1 两、步兵 1.5 两
  guard: { name: '家丁', cost: 0.2, grain: 0.2, morale: 0, pay: 0.6, note: '看家护院' },
  retainer: { name: '护院', cost: 0.5, grain: 0.3, morale: 1, pay: 0.9, note: '精壮护院' },
  army: { name: '营兵', cost: 0.8, grain: 0.4, morale: 2, pay: 1.5, note: '能出征的营兵' },
};""")

# ② 记录兵种构成（放饷按构成算）
s = s.replace("""  f.fresh = Math.round(num(f.fresh) + n);""",
"""  f.kinds = f.kinds && typeof f.kinds === 'object' ? f.kinds : {};
  f.kinds[kind] = Math.round(num(f.kinds[kind]) + n);
  f.fresh = Math.round(num(f.fresh) + n);""")
s = s.replace("""  f.fresh = Math.round(num(f.fresh) + come);""",
"""  f.kinds = f.kinds && typeof f.kinds === 'object' ? f.kinds : {};
  f.kinds[kind] = Math.round(num(f.kinds[kind]) + come);
  f.fresh = Math.round(num(f.fresh) + come);""")

# ③ 月饷按兵种构成计算
s = s.replace("""    const due = round2(troops * MONTHLY_PAY);""",
"""    const due = round2(monthlyPayOf(f));""")

if 'export function monthlyPayOf' not in s:
    s = s.replace("/**\n * 放饷日：每月初一", """/** 这个势力每月该发多少饷（按兵种构成算） */
export function monthlyPayOf(f) {
  if (!f) return 0;
  const kinds = f.kinds && typeof f.kinds === 'object' ? f.kinds : null;
  const total = Object.values(f.stationed || {}).reduce((x, y) => x + (Number(y) || 0), 0) || Number(f.troops) || 0;
  if (!kinds) return Math.round(total * MONTHLY_PAY * 100) / 100;
  let sum = 0;
  let counted = 0;
  for (const [k, n] of Object.entries(kinds)) {
    const rate = (RECRUIT_KINDS[k]?.pay) ?? MONTHLY_PAY;
    sum += (Number(n) || 0) * rate;
    counted += Number(n) || 0;
  }
  // 兵种账与实际兵力对不上时，多出来的按 1 两补
  if (total > counted) sum += (total - counted) * MONTHLY_PAY;
  return Math.round(sum * 100) / 100;
}

/**
 * 放饷日：每月初一""", 1)

# ④ 口粮：明代卫所月粮一石，折 0.03 石/日
s = s.replace("export const GRAIN_PER_DAY = 0.02;", "export const GRAIN_PER_DAY = 0.03;   // 月粮约一石")

# ⑤ upkeepOf 也按兵种
s = s.replace("""export function upkeepOf(world, f) {
  const troops = totalTroops(world, f);
  return { troops, monthlyPay: round2(troops * MONTHLY_PAY), monthlyGrain: round2(troops * GRAIN_PER_DAY * 30) };
}""",
"""export function upkeepOf(world, f) {
  const troops = totalTroops(world, f);
  return { troops, monthlyPay: monthlyPayOf(f), monthlyGrain: round2(troops * GRAIN_PER_DAY * 30) };
}""")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('兵种月饷 + 兵种构成 + 月粮一石')
