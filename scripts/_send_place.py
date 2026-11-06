import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.85 相公说\"进你屋里/去你房间\""
add = """    // 8.835 让某人去某处：按地点名真的挪过去（引擎解析地点，不靠模型）
    try {
      const mSend = /(?:让|叫|命|打发|请)\\s*([\\u4e00-\\u9fa5]{2,4})\\s*(?:先)?\\s*(?:去|到|往|回)\\s*([\\u4e00-\\u9fa5]{2,8}?)(?:去|了|罢|吧|。|！|!|$)/.exec(String(sayText || ''));
      if (mSend) {
        const wSd = loadState(this.dataDir);
        const meSd = wSd.actors?.[this._viewerActorId || 'husband'] || wSd.actors?.husband;
        const whoSd = Object.values(wSd.actors || {}).find((a) => a && !a.dead && a.name === mSend[1]);
        if (whoSd) {
          const destSd = resolvePlaceTarget(wSd, mSend[2], { nearId: meSd?.location, actor: whoSd });
          if (destSd && wSd.places?.[destSd]) {
            const mvSd = moveActor(wSd, whoSd.id, destSd, 'world', '听命往某处');
            if (mvSd?.ok) {
              saveState(this.dataDir, wSd);
              reply += `\\n【提示】${whoSd.name}去了${wSd.places[destSd].name}。`;
              console.log(`[Departure] 听命：${whoSd.name} → ${wSd.places[destSd].name}`);
            } else {
              reply += `\\n【提示】${whoSd.name}去不了那里：${mvSd?.error || '路不通'}。`;
            }
          }
        }
      }
    } catch (err) { console.warn('[Departure] 听命去某处失败：', err.message); }

""" + anchor
if '8.835' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('去某处')
