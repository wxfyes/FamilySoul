import io
# ① 出门菜单：产业按身份过滤（别人的号看不到王甯家产）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        const props = (world.assets?.properties || []).map((x) => ({ name: x.name, income: x.incomePerDay || 0 }));"
new = """        // 产业只给"自己的"：相公看相公的，其他人只看自己名下或自己管的
        const props = (world.assets?.properties || [])
          .filter((x) => {
            if (!x) return false;
            if (actorId === 'husband') return x.owner === 'husband' || x.keeper === 'husband' || (!x.owner && !x.keeper);
            return x.owner === actorId || x.keeper === actorId;
          })
          .map((x) => ({ name: x.name, income: x.incomePerDay || 0 }));"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 出门菜单产业按身份过滤')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② 兵价与军械改成行情价；加家丁/护院两种募法
p2 = 'src/world/warfare.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("export const RECRUIT_COST = 12;", "export const RECRUIT_COST = 1.2;   // 家丁安家银（古代募兵约一两上下）")
t = t.replace("export const RECRUIT_GRAIN = 0.5;", "export const RECRUIT_GRAIN = 0.2;   // 随身粮")
t = t.replace("export const GEAR_PRICES = { weapon: 3, armor: 5, horse: 20, siege: 300 };",
              "export const GEAR_PRICES = { weapon: 0.6, armor: 1.8, horse: 9, siege: 40 };")
if 'RECRUIT_KINDS' not in t:
    t = t.replace("let eventSink = null;", """// 三种人：家丁（看家最便宜）、护院（精壮）、营兵（要地盘）
export const RECRUIT_KINDS = {
  guard: { name: '家丁', cost: 1.2, grain: 0.2, morale: 0, note: '看家护院' },
  retainer: { name: '护院', cost: 3.0, grain: 0.3, morale: 1, note: '精壮护院' },
  army: { name: '营兵', cost: 4.0, grain: 0.4, morale: 2, note: '能出征的营兵' },
};

let eventSink = null;""", 1)

# recruit 支持 kind
old_rec = """export function recruit(world, fid, count, city) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const n = Math.max(1, Math.min(500, Math.round(num(count))));
  const town = city && world.cities?.[city] ? city : factionCapital(world, f);
  if (!world.cities?.[town]) return { ok: false, error: '落脚城不存在' };

  const cost = round2(n * RECRUIT_COST);
  const needGrain = round2(n * RECRUIT_GRAIN);"""
new_rec = """export function recruit(world, fid, count, city, kind = 'guard') {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const n = Math.max(1, Math.min(500, Math.round(num(count))));
  const town = city && world.cities?.[city] ? city : factionCapital(world, f);
  if (!world.cities?.[town]) return { ok: false, error: '落脚城不存在' };

  const k = RECRUIT_KINDS[kind] || RECRUIT_KINDS.guard;
  const cost = round2(n * k.cost);
  const needGrain = round2(n * k.grain);"""
if old_rec in t:
    t = t.replace(old_rec, new_rec, 1)
    print('② 募兵支持家丁/护院/营兵')
t = t.replace("  f.morale = Math.min(100, Math.round(num(f.morale) + 1));\n  fire(world, { action: 'recruit'",
              "  f.morale = Math.min(100, Math.round(num(f.morale) + 1 + k.morale));\n  fire(world, { action: 'recruit'")
t = t.replace("{ text: `${f.name}在${town}募兵 ${n} 人` }", "{ text: `${f.name}在${town}募${k.name} ${n} 人` }")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('③ 兵价与军械改为行情价')
