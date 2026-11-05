import io

# ============ ① 兵制改"月饷 + 响应"：募兵不是一次买断 ============
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()

s = s.replace("export const RECRUIT_COST = 1.2;   // 家丁安家银（古代募兵约一两上下）",
              "export const MONTHLY_PAY = 1.0;    // 每兵每月饷银（一两/月）\nexport const RECRUIT_COST = 0.2;   // 安家银（意思一下，真正的担子是月饷）")
s = s.replace("export const PAY_PER_DAY = 0.05;", "export const PAY_PER_DAY = MONTHLY_PAY / 30;")
s = s.replace("  guard: { name: '家丁', cost: 1.2, grain: 0.2, morale: 0, note: '看家护院' },\n  retainer: { name: '护院', cost: 3.0, grain: 0.3, morale: 1, note: '精壮护院' },\n  army: { name: '营兵', cost: 4.0, grain: 0.4, morale: 2, note: '能出征的营兵' },",
              "  guard: { name: '家丁', cost: 0.2, grain: 0.2, morale: 0, note: '看家护院' },\n  retainer: { name: '护院', cost: 0.5, grain: 0.3, morale: 1, note: '精壮护院' },\n  army: { name: '营兵', cost: 0.8, grain: 0.4, morale: 2, note: '能出征的营兵' },")

# 新增：一呼百应（响应制）
if 'export function callToArms' not in s:
    s = s.replace("let eventSink = null;", """/**
 * 一呼百应：不是花钱买人，是看你的名声与这座城的日子。
 * 名声越高、民心越稳，来投的人越多；荒年乱世反而有人来吃粮。
 */
export function callToArms(world, fid, { city, max = 60, kind = 'guard' } = {}) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const town = city && world.cities?.[city] ? city : factionCapital(world, f);
  const ct = world.cities?.[town];
  if (!ct) return { ok: false, error: '没有这座城' };

  const fame = Number(world.actors?.[f.leader]?.fame?.value) || 0;
  const unrest = Number(ct.unrest) || 0;
  const wealth = Number(ct.wealth) || 30;
  const base = 3 + fame / 6 + (50 - unrest) / 4 + wealth / 20;
  const luck = 0.6 + Math.random() * 0.8;
  let come = Math.round(base * luck);
  come = Math.max(1, Math.min(Math.max(1, max), come));

  const k = RECRUIT_KINDS[kind] || RECRUIT_KINDS.guard;
  const cost = round2(come * k.cost);
  const grain = round2(come * k.grain);
  if (num(f.grain) < grain) return { ok: false, error: `粮不够：${come} 人要 ${grain} 石` };
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `安家银不够：要 ${cost} 两` };

  f.grain = round2(num(f.grain) - grain);
  setStationed(world, f, town, troopsAt(world, f, town) + come);
  f.fresh = Math.round(num(f.fresh) + come);
  f.freshUntilDay = (Number(world.clock?.day) || 1) + TRAIN_DAYS;
  fire(world, { action: 'recruit', actor: f.leader, place: town, payload: { text: `${f.name}在${town}一呼百应，来投 ${come} 人` } });
  return { ok: true, came: come, asked: max, troops: totalTroops(world, f), city: town, cost, monthlyPay: round2(totalTroops(world, f) * MONTHLY_PAY) };
}

/** 每月饷银与口粮（给面板显示） */
export function upkeepOf(world, f) {
  const troops = totalTroops(world, f);
  return { troops, monthlyPay: round2(troops * MONTHLY_PAY), monthlyGrain: round2(troops * GRAIN_PER_DAY * 30) };
}

let eventSink = null;""", 1)
    print('① 加一呼百应与月饷口径')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② server：call 动作 + 负载月饷 ============
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { recruit, buyGrain, besiege, bribeCity, fortify, march, stationTroops, transferPropertyGrain, troopsAt, totalTroops, buyGear } from './world/warfare.js';",
              "import { recruit, buyGrain, besiege, bribeCity, fortify, march, stationTroops, transferPropertyGrain, troopsAt, totalTroops, buyGear, callToArms, upkeepOf } from './world/warfare.js';")
old = "        else if (act === 'gear') result = buyGear(world, fid, String(body.kind || 'weapon'), Number(body.qty) || 0);"
new = """        else if (act === 'gear') result = buyGear(world, fid, String(body.kind || 'weapon'), Number(body.qty) || 0);
        else if (act === 'call') result = callToArms(world, fid, { city: String(body.city || ''), max: Number(body.max) || 60, kind: String(body.kind || 'guard') });"""
if old in t:
    t = t.replace(old, new, 1)
    print('② 接口加 call')

# 负载：月饷与月粮
t = t.replace("          gear: f.gear || {}, fresh: Number(f.fresh) || 0, freshUntilDay: Number(f.freshUntilDay) || 0,",
              "          gear: f.gear || {}, fresh: Number(f.fresh) || 0, freshUntilDay: Number(f.freshUntilDay) || 0,\n          monthlyPay: upkeepOf(world, f).monthlyPay, monthlyGrain: upkeepOf(world, f).monthlyGrain,")
io.open(p2, 'w', encoding='utf-8-sig').write(t)

# ============ ③ 聊天标签：[[recruit:20]] → 一呼百应 ============
p3 = 'src/pet-service.js'
u = io.open(p3, encoding='utf-8-sig').read()
old3 = """        wMil.pendingAction = {
          kind: 'military',
          id: `pend_mil_${Date.now()}`,
          title: '募兵',
          action: 'recruit',"""
new3 = """        wMil.pendingAction = {
          kind: 'military',
          id: `pend_mil_${Date.now()}`,
          title: '招募',
          action: 'call',"""
if old3 in u:
    u = u.replace(old3, new3, 1)
    # 确认执行改为 call
    print('③ 聊天募兵改为招募')
io.open(p3, 'w', encoding='utf-8-sig').write(u)
