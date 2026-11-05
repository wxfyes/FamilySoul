import io

# ============ ① 产业进项受物候影响 ============
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'season.js' not in s:
    s = s.replace("import { npcStrategyTurn, maybeSpawnWarlord } from './strategy.js';",
                  "import { npcStrategyTurn, maybeSpawnWarlord } from './strategy.js';\n"
                  "import { propertySeasonFactor, maybeOutbreak, canalFrozen } from './season.js';\n"
                  "import { driftMarket, bumpMarket, ensureMarket } from './prices.js';", 1)
    print('① 引入 season/prices')

# 产业进项：乘物候系数
old = """  // 收益率封顶：单日不超过本金 12%，不出现离谱通胀
  rate = Math.max(0.01, Math.min(0.12, rate));"""
new = """  // 物候：冬天封河，水路生意腰斩；春茶秋茶各有贵贱
  rate *= propertySeasonFactor(world, prop);

  // 收益率封顶：单日不超过本金 12%，不出现离谱通胀
  rate = Math.max(0.01, Math.min(0.12, rate));"""
if old in s:
    s = s.replace(old, new, 1)
    print('② 产业按物候打折')

# 每日：物价指数回归 + 灾荒/战事冲击 + 疫病
anchor = """  // 枭雄自生：民怨高的城会有人竖旗（规则触发，不写剧本）"""
block = """  // 物价：指数每日回归，再被灾荒、战事、丰收冲击
  try {
    ensureMarket(world);
    driftMarket(world);
    const shocks = {};
    const todayEvents = events || [];
    const disasters = todayEvents.filter((e) => e && e.action === 'disaster').length;
    const wars = todayEvents.filter((e) => e && ['city_taken', 'siege_failed', 'warlord_spawn'].includes(e.action)).length;
    const harvest = todayEvents.filter((e) => e && e.action === 'harvest').length;
    if (disasters) { shocks.grain = 1 + 0.25 * disasters; shocks.herb = 1 + 0.15 * disasters; }
    if (wars) { shocks.grain = (shocks.grain || 1) * (1 + 0.1 * wars); shocks.iron = 1 + 0.15 * wars; }
    if (harvest) { shocks.grain = 0.85; }
    if (Object.keys(shocks).length) bumpMarket(world, shocks);
    // 灾后疫病
    maybeOutbreak(world, todayEvents, nextEvent);
  } catch (err) {
    console.warn('[Market] 物价结算失败：', err.message);
  }

""" + anchor
if '物价：指数每日回归' not in s:
    s = s.replace(anchor, block, 1)
    print('③ 每日物价与疫病')

io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② 行军受物候影响 ============
p2 = 'src/world/warfare.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'season.js' not in t:
    t = t.replace("import { canReach } from './geography.js';",
                  "import { canReach } from './geography.js';\nimport { marchSpeedFactor, gearCostFactor } from './season.js';\nimport { grainPrice } from './prices.js';")
    print('④ 引入物候到兵权')

# 行军天数按物候放大
old_days = "  const arriveDay = (Number(world.clock?.day) || 1) + road.days;"
new_days = "  const daysReal = Math.max(1, Math.ceil(road.days * marchSpeedFactor(world)));\n  const arriveDay = (Number(world.clock?.day) || 1) + daysReal;"
if old_days in t:
    t = t.replace(old_days, new_days, 1)
    t = t.replace("  fire(world, { action: 'march_start', actor: f.leader, place: fromCity, payload: { text: `${f.name}${send}兵自${fromCity}开拔，${road.days}日可至${toCity}` } });",
                  "  fire(world, { action: 'march_start', actor: f.leader, place: fromCity, payload: { text: `${f.name}${send}兵自${fromCity}开拔，${daysReal}日可至${toCity}` } });")
    t = t.replace("  return { ok: true, days: road.days, arriveDay, troops: send };",
                  "  return { ok: true, days: daysReal, arriveDay, troops: send };")
    print('⑤ 行军按物候加时')

# 买粮按市价
old_grain = """  const amount = Math.max(1, Math.min(2000, Math.round(num(shi))));
  const cost = round2(amount * GRAIN_PRICE);"""
new_grain = """  const amount = Math.max(1, Math.min(2000, Math.round(num(shi))));
  const unitPrice = grainPrice(world, city || factionCapital(world, f));
  const cost = round2(amount * unitPrice);"""
if old_grain in t:
    t = t.replace(old_grain, new_grain, 1)
    print('⑥ 购粮按市价')

# 军械按铁价
old_gear = """  const n = Math.max(1, Math.min(500, Math.round(num(qty))));
  const cost = round2(n * price);"""
new_gear = """  const n = Math.max(1, Math.min(500, Math.round(num(qty))));
  const ironFactor = ['weapon', 'armor', 'siege'].includes(k) ? gearCostFactor(world) : 1;
  const cost = round2(n * price * ironFactor);"""
if old_gear in t:
    t = t.replace(old_gear, new_gear, 1)
    print('⑦ 军械按铁价')
io.open(p2, 'w', encoding='utf-8-sig').write(t)

# ============ ③ 世界负载带物价与物候 ============
p3 = 'src/server.js'
u = io.open(p3, encoding='utf-8-sig').read()
if 'marketSnapshot' not in u:
    u = u.replace("import { buildStrategyPrompt, applyStrategyDecisions } from './world/strategy.js';",
                  "import { buildStrategyPrompt, applyStrategyDecisions } from './world/strategy.js';\n"
                  "import { marketSnapshot } from './world/prices.js';\n"
                  "import { canalFrozen } from './world/season.js';")
    # /api/me 负载
    u = u.replace("        factions: Object.values(world.factions || {}).map((f) => ({",
                  "        market: marketSnapshot(world),\n"
                  "        season: { season: world.clock?.season || '', weather: world.clock?.weather || '', canalFrozen: canalFrozen(world) },\n"
                  "        factions: Object.values(world.factions || {}).map((f) => ({", 1)
    print('⑧ 负载带物价与物候')
io.open(p3, 'w', encoding='utf-8-sig').write(u)
