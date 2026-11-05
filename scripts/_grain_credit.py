import io
# ① 购粮直接进府库（招兵看的就是府库），不再只记到城里
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const town = city && world.cities?.[city] ? city : (Array.isArray(f.cities) && f.cities[0]) || '';
  if (town && world.cities?.[town]) {
    world.cities[town].grain = round2(num(world.cities[town].grain) + amount);
    if (f.id === 'wangjia') syncWangjiaToMilitary(world);
    return { ok: true, grain: world.cities[town].grain, city: town, cost };
  }
  f.grain = round2(num(f.grain) + amount);
  if (f.id === 'wangjia') syncWangjiaToMilitary(world);
  return { ok: true, grain: f.grain, city: '', cost };"""
new = """  // 粮进府库（招兵、放粮看的都是这一个数）；城里另记一份徭赈库存，供赈济与守城用
  f.grain = round2(num(f.grain) + amount);
  const town = city && world.cities?.[city] ? city : (Array.isArray(f.cities) && f.cities[0]) || '';
  if (town && world.cities?.[town]) {
    world.cities[town].grain = round2(num(world.cities[town].grain) + Math.round(amount * 0.3 * 100) / 100);
  }
  if (f.id === 'wangjia') syncWangjiaToMilitary(world);
  return { ok: true, grain: f.grain, city: town, cost, unitPrice };"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 购粮进府库')

# ② 迁移：把市场粮价基数改到 0.4（老存档缓存了 0.6）
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'priceBaseFixV1' not in t:
    anchor = "  // 一次性：清掉\"几个铺子/若干铺\"这类被量词骗出来的假产业"
    add = """  // 一次性：粮价基数归位（明末江南丰年一石约四钱）
  try {
    world.flags = world.flags || {};
    if (!world.flags.priceBaseFixV1) {
      world.market = world.market || {};
      if (world.market.grain) world.market.grain.base = 0.4;
      world.flags.priceBaseFixV1 = { day: world.clock?.day || 1 };
      console.log('[Price] 粮价基数归位 0.4 两/石');
    }
  } catch { /* 忽略 */ }

""" + anchor
    if anchor in t:
        t = t.replace(anchor, add, 1)
        io.open(p2, 'w', encoding='utf-8-sig').write(t)
        print('② 粮价基数迁移')
