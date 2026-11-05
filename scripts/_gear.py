import io

# ============ ① warfare：装备（兵器/甲/马/攻城器械）+ 新兵成军 ============
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'GEAR_PRICES' not in s:
    s = s.replace("export const GRAIN_PRICE = 0.6;", """export const GRAIN_PRICE = 0.6;

/** 军械作价（两） */
export const GEAR_PRICES = { weapon: 3, armor: 5, horse: 20, siege: 300 };
export const GEAR_NAMES = { weapon: '兵器', armor: '铠甲', horse: '战马', siege: '攻城器械' };
/** 新兵成军天数 */
export const TRAIN_DAYS = 7;""")
    print('① 军械价目与新兵天数')

# 战力公式：加入装备比例与新兵折损
old_strength = """export function factionStrength(world, f) {"""
# factionStrength 在 factions.js，这里补一个装备系数函数供其使用
if 'export function gearFactor' not in s:
    s = s.replace("let eventSink = null;", """let eventSink = null;

/** 装备系数：兵甲齐备者更强（0.7 ~ 1.6） */
export function gearFactor(f) {
  const troops = Math.max(1, Number(f?.troops) || 0);
  const g = f?.gear || {};
  const wpn = Math.min(Number(g.weapon) || 0, troops) / troops;
  const arm = Math.min(Number(g.armor) || 0, troops) / troops;
  const horse = Math.min(Number(g.horse) || 0, troops) / troops;
  return 0.7 + wpn * 0.3 + arm * 0.25 + horse * 0.35;
}

/** 买军械 */
export function buyGear(world, fid, kind, qty) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const k = String(kind || '');
  const price = GEAR_PRICES[k];
  if (!price) return { ok: false, error: '没有这种军械' };
  const n = Math.max(1, Math.min(500, Math.round(num(qty))));
  const cost = round2(n * price);
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：${n} 件${GEAR_NAMES[k]}要 ${cost} 两` };
  f.gear = f.gear && typeof f.gear === 'object' ? f.gear : {};
  f.gear[k] = Math.round((Number(f.gear[k]) || 0) + n);
  return { ok: true, gear: f.gear, cost };
}""")
    print('② 军械函数')

# 募兵记为"新兵"，7 天后成军
old_recruit_tail = """  f.grain = round2(num(f.grain) - needGrain);
  setStationed(world, f, town, troopsAt(world, f, town) + n);
  f.morale = Math.min(100, Math.round(num(f.morale) + 1));"""
new_recruit_tail = """  f.grain = round2(num(f.grain) - needGrain);
  setStationed(world, f, town, troopsAt(world, f, town) + n);
  // 新募之兵要练：七天之内战力只有四成
  f.fresh = Math.round(num(f.fresh) + n);
  f.freshUntilDay = (Number(world.clock?.day) || 1) + TRAIN_DAYS;
  f.morale = Math.min(100, Math.round(num(f.morale) + 1));"""
if old_recruit_tail in s:
    s = s.replace(old_recruit_tail, new_recruit_tail, 1)
    print('③ 新兵成军')

# 每日：新兵到期成军
old_loop = """  // 行军抵达"""
new_loop = """  // 新兵成军
  for (const f of Object.values(world.factions || {})) {
    if (!f || !(Number(f.fresh) > 0)) continue;
    if ((Number(world.clock?.day) || 1) >= (Number(f.freshUntilDay) || 0)) {
      fire(world, { action: 'army_ready', actor: f.leader, place: null, payload: { text: `${f.name}新募 ${f.fresh} 兵已成军` } });
      f.fresh = 0;
      f.freshUntilDay = 0;
    }
  }

  // 行军抵达"""
if old_loop in s:
    s = s.replace(old_loop, new_loop, 1)
    print('④ 新兵到期成军')

# 围城：攻城器械加成
old_atk = "  const attackPower = Math.round(factionStrength(world, f) * (send / Math.max(1, totalTroops(world, f))));"
new_atk = """  const siegeBonus = Math.min(60, Math.round((Number(f.gear?.siege) || 0) * 15));
  const attackPower = Math.round(factionStrength(world, f) * (send / Math.max(1, totalTroops(world, f))) + siegeBonus);"""
if old_atk in s:
    s = s.replace(old_atk, new_atk, 1)
    print('⑤ 攻城器械加成')

io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② factions.js 战力公式纳入装备与新兵 ============
p2 = 'src/world/factions.js'
t = io.open(p2, encoding='utf-8-sig').read()
old_s = """export function factionStrength(world, f) {
  if (!f) return 0;
  const troops = num(f.troops);
  if (troops <= 0) return 0;
  const morale = Math.max(10, Math.min(120, num(f.morale) || 50));
  const quality = f.id === 'wangjia' ? Math.max(20, num(world.military?.quality) || 50) : 50;
  return Math.round(troops * (0.6 + morale / 100) * (quality / 50));
}"""
new_s = """export function factionStrength(world, f) {
  if (!f) return 0;
  const troops = num(f.troops);
  if (troops <= 0) return 0;
  const morale = Math.max(10, Math.min(120, num(f.morale) || 50));
  const quality = f.id === 'wangjia' ? Math.max(20, num(world.military?.quality) || 50) : 50;
  // 新兵只算四成战力
  const fresh = Math.min(num(f.fresh), troops);
  const effective = (troops - fresh) + fresh * 0.4;
  // 装备系数（兵甲马）
  const g = f.gear || {};
  const wpn = Math.min(num(g.weapon), troops) / Math.max(1, troops);
  const arm = Math.min(num(g.armor), troops) / Math.max(1, troops);
  const horse = Math.min(num(g.horse), troops) / Math.max(1, troops);
  const gear = 0.7 + wpn * 0.3 + arm * 0.25 + horse * 0.35;
  return Math.round(effective * (0.6 + morale / 100) * (quality / 50) * gear);
}"""
if old_s in t:
    t = t.replace(old_s, new_s, 1)
    print('⑥ 战力纳入装备与新兵')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
