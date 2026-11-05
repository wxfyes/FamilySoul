import io

# ① 天道提示词里塞真实粮价与今日行情
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 府中兵事与存粮"
add = """    // 今日真实行情：粮价、盐价等按引擎的数，不许天道随口报（"四钱一石"这种便宜价会坑了相公）
    try {
      const wPx = loadState(this.dataDir);
      const mePx = this._viewerActorId ? wPx.actors?.[this._viewerActorId] : wPx.actors?.husband;
      const cityPx = Object.values(wPx.cities || {}).find((c) => c && c.name && String(wPx.places?.[mePx?.location]?.name || '').includes(String(c.name).slice(0, 2)))?.name
        || Object.keys(wPx.cities || {})[0] || '临江府';
      const g = grainPrice(wPx, cityPx);
      const parts = [`${cityPx}今日米价 ${g.toFixed(2)} 两/石（买 10 石 = ${(g * 10).toFixed(2)} 两，买 50 石 = ${(g * 50).toFixed(2)} 两）`];
      for (const k of ['salt', 'tea', 'silk', 'iron']) {
        try { parts.push(`${k === 'salt' ? '盐' : k === 'tea' ? '茶' : k === 'silk' ? '丝' : '铁'} ${priceAt(wPx, cityPx, k).toFixed(2)} 两`); } catch { /* 忽略 */ }
      }
      contextHintEarly += `（【今日行情】${parts.join('；')}。凡谈到价钱，一律照这个数说；绝不许可自报一个更便宜的价来哄相公。）\\n`;
    } catch { /* 忽略 */ }

""" + anchor
if '【今日行情】' not in s:
    s = s.replace(anchor, add, 1)
    if 'grainPrice' not in s.split('async chat')[0]:
        s = s.replace("import { describeRoom, roomForHour } from './world/room-life.js';",
                      "import { describeRoom, roomForHour } from './world/room-life.js';\nimport { grainPrice, priceAt } from './world/prices.js';")
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 注入真实行情')

# ② 假产业清理换新标记，确保这次真跑
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("if (!world.flags.propertyCleanupV1) {", "if (!world.flags.propertyCleanupV2) {")
t = t.replace("world.flags.propertyCleanupV1 = { removed:", "world.flags.propertyCleanupV2 = { removed:")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('② 假产业清理换 V2 重跑')
