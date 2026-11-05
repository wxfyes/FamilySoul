import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (who && who.location !== hereLoc) {
          console.log(`[Presence] 剔除非在场发言：${spk}（此刻在${wPres.places?.[who.location]?.name || '别处'}）`);
          continue;
        }"""
new = """        if (who && who.location !== hereLoc) {
          // 例外：王甯是真人常客，他的相好/妻妾喊他，他隔着地方应一句是合理的；
          // 生客（如离析）喊他，就绝不许他"人在万花楼"开口。
          const rel = mePres?.relations?.[who.id] || who.relations?.[mePres?.id] || {};
          const closeToHim = Boolean(
            mePres?.spouse === 'husband' || mePres?.household
            || rel.lover || Number(rel.desire) >= 40 || Number(rel.trust) >= 55,
          );
          if (who.id === 'husband' && closeToHim) {
            kept.push(seg);
            continue;
          }
          console.log(`[Presence] 剔除非在场发言：${spk}（此刻在${wPres.places?.[who.location]?.name || '别处'}）`);
          continue;
        }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 亲眷可隔空应声，生客不行')
