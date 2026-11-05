import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = """    const __t1 = Date.now();
    reply = this.processNarrativeTags(reply, say);"""
add = """    // 【在场铁律】不在场的人不许开口：把 【某某】 段落里"此刻不在同一地点"的人整段剔掉
    try {
      const wPres = loadState(this.dataDir);
      const mePres = this._viewerActorId ? wPres.actors?.[this._viewerActorId] : wPres.actors?.husband;
      const hereLoc = mePres?.location;
      const segs = String(reply || '').split(/(?=【[^】\\n]{1,12}】)/).filter(Boolean);
      const kept = [];
      for (const seg of segs) {
        const m = seg.match(/^【([^】\\n]{1,12})】/);
        if (!m) { kept.push(seg); continue; }
        const spk = m[1].trim();
        if (/天道|旁白|众人/.test(spk) || spk === (mePres?.name || '')) { kept.push(seg); continue; }
        const who = Object.values(wPres.actors || {}).find((a) => a && !a.dead && a.name && (a.name === spk || spk.includes(a.name) || a.name.includes(spk)));
        if (who && who.location !== hereLoc) {
          console.log(`[Presence] 剔除非在场发言：${spk}（此刻在${wPres.places?.[who.location]?.name || '别处'}）`);
          continue;
        }
        kept.push(seg);
      }
      const merged = kept.join('').trim();
      if (merged) reply = merged;
    } catch { /* 忽略 */ }

""" + anchor
if '[Presence]' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加"不在场的人不许开口"')
