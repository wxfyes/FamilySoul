import io

# ============ ① 时间公理统一：一年 360 天（12 月 × 30 天，四季各 90 天） ============
p = 'src/world/aging.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("export const DAYS_PER_YEAR = 30;",
              "export const DAYS_PER_YEAR = 360;   // 与世界历法一致：360 日一年（四季各 90 日）")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('① 长岁改为一年 360 天')

# 删掉 clock.js 里那套重复的长岁（day % 360）
p2 = 'src/world/clock.js'
c = io.open(p2, encoding='utf-8-sig').read()
old_age = "    if (day % 360 === 0) a.age = (Number(a.age) || 20) + 1;"
if old_age in c:
    c = c.replace(old_age, "    // 长岁统一由 aging.js 负责（此处不再重复加岁）", 1)
    print('② 删掉重复长岁')

# 秋收改为一年一次（秋分前后）
old_harvest = "  if (day % 30 === 0) {\n    // 秋粮折银：陈粮卖一部分换现银（丰年多、荒年少）"
new_harvest = "  if (day % 360 === 240) {\n    // 秋粮折银：陈粮卖一部分换现银（丰年多、荒年少）"
if old_harvest in c:
    c = c.replace(old_harvest, new_harvest, 1)
    print('③ 秋收改为一年一次')

# 物候双重叠乘：删掉旧的茶/酒季节特判，只认 season.js
old_tea = "  if (/茶/.test(String(prop.name || ''))) rate *= season === 'spring' ? 1.3 : season === 'winter' ? 0.85 : 1.05;\n"
old_wine = "  if (/酒/.test(String(prop.name || ''))) rate *= season === 'winter' ? 1.35 : 1.1;\n"
if old_tea in c:
    c = c.replace(old_tea, "", 1)
    print('④ 删旧茶季特判')
if old_wine in c:
    c = c.replace(old_wine, "", 1)
    print('⑤ 删旧酒季特判')
io.open(p2, 'w', encoding='utf-8-sig').write(c)

# ============ ② 疫病只在本道与邻道扩散 ============
p3 = 'src/world/season.js'
t = io.open(p3, encoding='utf-8-sig').read()
old_out = """  if (Math.random() > 0.25) return false;
  let hit = 0;
  for (const ct of Object.values(world.cities || {})) {
    if (!ct) continue;
    ct.unrest = Math.min(100, num(ct.unrest) + 5);
    hit += 1;
  }"""
new_out = """  if (Math.random() > 0.25) return false;

  // 只在本道与相邻道扩散，不做全国一刀切
  const region = String((events[0] && events[0].place) || world.actors?.husband?.place || '');
  const spreadRegions = new Set();
  if (region) {
    spreadRegions.add(region);
    for (const nb of neighbors(region)) spreadRegions.add(nb);
  }
  let hit = 0;
  for (const ct of Object.values(world.cities || {})) {
    if (!ct) continue;
    const r = String(ct.region || '');
    if (spreadRegions.size && !spreadRegions.has(r)) continue;
    ct.unrest = Math.min(100, num(ct.unrest) + 5);
    hit += 1;
  }"""
if old_out in t:
    t = t.replace(old_out, new_out, 1)
    # 引入邻道
    t = t.replace("const num = (v) => {", "import { neighborRegions } from './geography.js';\n\nconst num = (v) => {")
    t = t.replace("for (const nb of neighbors(region)) spreadRegions.add(nb);",
                  "for (const nb of neighborRegions(world, region)) spreadRegions.add(nb);")
    print('⑥ 疫病限定本道与邻道')
io.open(p3, 'w', encoding='utf-8-sig').write(t)
