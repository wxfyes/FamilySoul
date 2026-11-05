import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "        goods: goodsSnapshot(world),"
block = """        // 今日看板：把一天里值得看的事收成一张单子（过滤掉"回了/待久了"这类噪音）
        digest: (() => {
          try {
            const day = Number(world.clock?.day) || 1;
            const meId = actorId || 'husband';
            const meNow = world.actors?.[meId] || world.actors?.husband;
            const noisy = /回了|待久了|自己宅里走动|按作息走动|归位/;
            const evs = readRecentEvents(DATA_DIR, 60) || [];
            const today = evs
              .filter((e) => e && Number(e.day) === day)
              .map((e) => ({ text: String(e?.payload?.text || ''), day: e.day, hour: e.hour || 0, action: e.action || '' }))
              .filter((x) => x.text && !noisy.test(x.text))
              .slice(-8)
              .reverse();
            const big = (world.milestones || []).slice(-4).map((m) => (typeof m === 'string' ? m : (m?.text || m?.title || ''))).filter(Boolean);
            const hist = (world.history || []).slice(-3);
            const h1 = hist[hist.length - 1];
            const h0 = hist[hist.length - 2];
            const priceMove = h1 && h0 ? Math.round((Number(h1.price) - Number(h0.price)) * 10) / 10 : 0;
            const unrestMove = h1 && h0 ? Number(h1.unrest) - Number(h0.unrest) : 0;
            const household = Object.values(world.actors || {})
              .filter((a) => a && !a.dead && (a.household || a.spouse === 'husband'))
              .map((a) => ({
                name: a.name,
                role: a.role || '',
                status: a.pregnancy && !a.pregnancy.born ? `有孕${Number(a.pregnancy.days) || 0}月` : (a.quarters ? '在府' : ''),
              }));
            return {
              day,
              hour: Number(world.clock?.hour) || 0,
              weather: world.clock?.weather || '',
              season: world.clock?.season || '',
              place: world.places?.[meNow?.location]?.name || '',
              silver: Number(world.assets?.silver) || 0,
              grain: Number(world.factions?.wangjia?.grain) || 0,
              troops: Number(world.factions?.wangjia?.troops) || 0,
              priceMove,
              unrestMove,
              household,
              today,
              big,
              decree: world.decrees?.[world.decrees.length - 1]?.text || '',
            };
          } catch { return null; }
        })(),"""
if 'digest: (()' not in s:
    s = s.replace(anchor, block, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① /api/me 带今日看板')
