import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old_start = "        digest: (() => {"
i = s.find(old_start)
j = s.find("        })(),", i)
if i < 0 or j < 0:
    raise SystemExit('找不到 digest 块')
block = """        digest: (() => {
          try {
            const day = Number(world.clock?.day) || 1;
            const meNow = (actorId && world.actors?.[actorId]) || me || world.actors?.husband;
            const isBoss = meNow?.id === 'husband' || meNow?.household || meNow?.spouse === 'husband';
            const noisy = /回了|待久了|自己宅里走动|按作息走动|归位/;
            const evs = readRecentEvents(DATA_DIR, 60) || [];
            const myName = String(meNow?.name || '');
            const today = evs
              .filter((e) => e && Number(e.day) === day)
              .map((e) => ({ text: String(e?.payload?.text || ''), day: e.day, hour: e.hour || 0, action: e.action || '' }))
              .filter((x) => x.text && !noisy.test(x.text))
              // 只看与自己有关的：本人/王家（家眷）
              .filter((x) => (myName && x.text.includes(myName)) || (isBoss && /王家|王宅|相公|府里/.test(x.text)))
              .slice(-8)
              .reverse();
            // 大事记是王家的账，只有王家人看得到
            const big = isBoss
              ? (world.milestones || []).slice(-4).map((m) => (typeof m === 'string' ? m : (m?.text || m?.title || ''))).filter(Boolean)
              : [];
            const hist = (world.history || []).slice(-3);
            const h1 = hist[hist.length - 1];
            const h0 = hist[hist.length - 2];
            const priceMove = h1 && h0 ? Math.round((Number(h1.price) - Number(h0.price)) * 10) / 10 : 0;
            const unrestMove = h1 && h0 ? Number(h1.unrest) - Number(h0.unrest) : 0;
            // 府里人：是王家人就看全府，不是就只看自己身边
            const kinRaw = Object.values(world.actors || {}).filter((a) => a && !a.dead);
            const householdList = kinRaw
              .filter((a) => (isBoss
                ? (a.household || a.spouse === 'husband')
                : (a.id === meNow?.spouse || (Array.isArray(a.parents) && a.parents.includes(meNow?.id)))))
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
              silver: getMoney(world, meNow?.id || 'husband'),
              grain: isBoss ? (Number(world.factions?.wangjia?.grain) || 0) : null,
              troops: isBoss ? (Number(world.factions?.wangjia?.troops) || 0) : null,
              priceMove,
              unrestMove,
              household: householdList,
              today,
              big,
              decree: isBoss ? (world.decrees?.[world.decrees.length - 1]?.text || '') : '',
            };
          } catch { return null; }
"""
s = s[:i] + block + s[j:]
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('① 今日看板按账号隔离')
