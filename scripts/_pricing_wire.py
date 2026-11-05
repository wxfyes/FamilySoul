import io

# ① 军械/战马改按价目表
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'pricing.js' not in s:
    s = s.replace("import { grainPrice } from './prices.js';",
                  "import { grainPrice } from './prices.js';\nimport { priceOf } from './pricing.js';", 1)
    print('① warfare 引入价目表')
s = s.replace("export const GEAR_PRICES = { weapon: 0.6, armor: 1.8, horse: 9, siege: 40 };",
              "export const GEAR_PRICES = { weapon: priceOf('weapon'), armor: priceOf('armor'), horse: priceOf('horse'), siege: priceOf('siege') };")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('② 军械改价目表')

# ② 月例按史实（明 长工年 3~5 两 → 月 0.3~0.4；内眷月钱略高）
p2 = 'src/world/clock.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("""  const ALLOWANCE = [
    { re: /正妻|大娘子/, amount: 5.0 },
    { re: /如夫人|二房|侧室|妾/, amount: 3.0 },
    { re: /通房|贴身丫鬟|丫鬟|丫头/, amount: 0.8 },
  ];
  const OUTSIDER = 2.0;   // 外室（不入府，暗中给）
  const CHILD = 0.3;      // 每个孩子""",
"""  // 月例按明制家用：长工一年 3~5 两，内眷月钱略高（1 两 ≈ 1.7 石米）
  const ALLOWANCE = [
    { re: /正妻|大娘子/, amount: 1.5 },
    { re: /如夫人|二房|侧室|妾/, amount: 1.0 },
    { re: /通房|贴身丫鬟|丫鬟|丫头/, amount: 0.3 },
  ];
  const OUTSIDER = 0.5;   // 外室（不入府，暗中给）
  const CHILD = 0.1;      // 每个孩子""")
print('③ 月例改史实')

# ③ 工钱：0.12 两/日 → 0.04 两/日（短工）
t = t.replace("    const wage = Math.round(staff * 0.12 * 100) / 100;", "    const wage = Math.round(staff * 0.04 * 100) / 100;   // 短工日钱，明制约三四分银")
print('④ 工钱改史实')
io.open(p2, 'w', encoding='utf-8-sig').write(t)

# ④ 开房价：天道报价夹回人间（客栈上房 0.03~0.2 两/日）
p3 = 'src/pet-service.js'
u = io.open(p3, encoding='utf-8-sig').read()
if 'pricing.js' not in u:
    u = u.replace("import { personFacts } from './world/person-facts.js';",
                  "import { personFacts } from './world/person-facts.js';\nimport { sanePrice, priceHint } from './world/pricing.js';", 1)
    print('⑤ pet-service 引入价目表')

old = """        if (opts2.length > 0) {
          const wPay = loadState(dataDir);"""
new = """        if (opts2.length > 0) {
          // 报价夹回人间：房钱、饭钱这类，天道随口报多大都要收回来
          const clampKey = (label) => {
            const s2 = String(label || '');
            if (/房|宿|住/.test(s2)) return 'inn_room';
            if (/饭|菜|食/.test(s2)) return 'meal';
            if (/酒/.test(s2)) return 'wine';
            if (/马/.test(s2)) return 'horse';
            if (/刀|箭|兵器/.test(s2)) return 'weapon';
            if (/甲/.test(s2)) return 'armor';
            if (/宅|院/.test(s2)) return 'mansion';
            if (/铺|店|楼/.test(s2)) return 'shop';
            return null;
          };
          for (const o of opts2) {
            const k = clampKey(`${o.label} ${title2}`);
            if (k) o.price = sanePrice(k, o.price);
          }
          const wPay = loadState(dataDir);"""
if old in u:
    u = u.replace(old, new, 1)
    print('⑥ 开房价等报价夹区间')

# 给天道一份价目参考
hint_anchor = "      contextHintEarly += '（【兵事规矩】"
hint = """      contextHintEarly += '（【物价参考】${priceHint()}。报钱一律照这个来，不许编出"一晚房钱三两"这种价。）\\n';
""" + hint_anchor
if '【物价参考】' not in u:
    u = u.replace(hint_anchor, hint, 1)
    print('⑦ 天道价目参考')
io.open(p3, 'w', encoding='utf-8-sig').write(u)
