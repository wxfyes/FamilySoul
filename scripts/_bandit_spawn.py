import io
p = 'src/world/bandits.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  for (const [cityName, ct] of Object.entries(world.cities || {})) {
    if (!ct) continue;
    if (num(ct.unrest) < 50) continue;
    if (Object.values(world.bandits).some((b) => b && b.homeCity === cityName)) continue;
    if (Math.random() > 0.3) continue;"""
new = """  const disasterToday = (events || []).some((e) => e && e.action === 'disaster');
  const perRegion = {};
  for (const b of Object.values(world.bandits)) {
    if (!b) continue;
    perRegion[b.region || ''] = (perRegion[b.region || ''] || 0) + 1;
  }

  for (const [cityName, ct] of Object.entries(world.cities || {})) {
    if (!ct) continue;
    if (Object.values(world.bandits).some((b) => b && b.homeCity === cityName)) continue;
    if ((perRegion[ct.region || ''] || 0) >= 3) continue;   // 一道最多三股，免得遍地开花

    // 匪不是"民怨到 50 才发生"，是几件事一起：民怨、灾荒、地形、官府兵备
    const rugged = /山|岭|水|湖|泽|关/.test(`${ct.name || ''} ${ct.region || ''}`);
    const weakDefense = num(ct.defense) < 20;
    let chance = 0.05;
    chance += Math.min(0.3, num(ct.unrest) / 200);
    if (disasterToday) chance += 0.15;
    if (rugged) chance += 0.05;
    if (weakDefense) chance += 0.03;
    if (Math.random() > Math.min(0.5, chance)) continue;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('匪患改成多因子萌生（民怨/灾荒/地形/兵备）')
