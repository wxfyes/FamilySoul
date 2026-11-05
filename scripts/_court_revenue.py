import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """  // 收：朝廷的城
  let income = 0;
  for (const ct of Object.values(world.cities || {})) {
    if (!ct) continue;
    const courtOwned = !ct.owner || ct.owner === 'court';
    if (!courtOwned) continue;
    const rawTax = Number(ct.tax);
    const tax = Math.max(0, Math.min(50, Number.isFinite(rawTax) ? rawTax : 10));
    income += Math.round(((Number(ct.wealth) || 30) * tax) / 100 / 3 * 100) / 100;
  }"""
new = """  // 收：城税 + 商税 + 关税（朝廷的城才上缴）
  let income = 0;
  let tariffCities = 0;
  let tradeTax = 0;
  for (const ct of Object.values(world.cities || {})) {
    if (!ct) continue;
    const courtOwned = !ct.owner || ct.owner === 'court';
    if (!courtOwned) continue;
    const rawTax = Number(ct.tax);
    const tax = Math.max(0, Math.min(50, Number.isFinite(rawTax) ? rawTax : 10));
    income += Math.round(((Number(ct.wealth) || 30) * tax) / 100 / 3 * 100) / 100;

    // 商税：市面上做买卖抽的厘金（税基薄，但城多）
    const wealth = Number(ct.wealth) || 30;
    tradeTax += wealth * 0.02;

    // 关税：靠水有码头的城，才有过税可抽
    const region = String(ct.region || '');
    if (/运河|码头|江南|淮|漕/.test(region + String(ct.name || ''))) tariffCities += 1;
  }
  tradeTax = Math.round(tradeTax * 100) / 100;
  const tariff = Math.round(tariffCities * 3 * 100) / 100;
  income = Math.round((income + tradeTax + tariff) * 100) / 100;"""
if old in s and '商税' not in s:
    s = s.replace(old, new, 1)
    print('① 城税+商税+关税')

# 秋粮折银：每 30 天，粮仓里陈粮折一部分银
old2 = """  if (day % 30 === 0) {
    tr.grain = Math.min(3000, (Number(tr.grain) || 0) + 600);"""
new2 = """  if (day % 30 === 0) {
    // 秋粮折银：陈粮卖一部分换现银（丰年多、荒年少）
    const grainNow = Number(tr.grain) || 0;
    const grainToSilver = Math.round(Math.min(200, grainNow * 0.1) * 1.2 * 100) / 100;
    if (grainToSilver > 0) {
      tr.silver = Math.round(((Number(tr.silver) || 0) + grainToSilver) * 100) / 100;
      tr.grain = Math.max(0, grainNow - Math.round(grainNow * 0.1));
      events.push(nextEvent(world, { action: 'grain_sale', actor: 'court', place: null, payload: { text: `秋粮折银 ${grainToSilver} 两` }, isPublic: true }));
    }
    tr.grain = Math.min(3000, (Number(tr.grain) || 0) + 600);"""
if old2 in s and '秋粮折银' not in s:
    s = s.replace(old2, new2, 1)
    print('② 秋粮折银')

# 记录明细，供看板与天道读
old3 = """  tr.lastIncome = Math.round(income * 100) / 100;"""
new3 = """  tr.lastIncome = Math.round(income * 100) / 100;
  tr.detail = { cityTax: Math.round((income - tradeTax - tariff) * 100) / 100, tradeTax, tariff, tariffCities };"""
if old3 in s and 'tr.detail' not in s:
    s = s.replace(old3, new3, 1)
    print('③ 记录收入明细')
io.open(p, 'w', encoding='utf-8-sig').write(s)
