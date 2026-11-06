import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 此间陈设与可做之事：只给事实，怎么接戏由天道决定"
add = """    // 街上的摊子：有什么摊、卖什么、什么价——天道照实写，不要凭空添摊
    try {
      const wSt = loadState(this.dataDir);
      const meSt = this._viewerActorId ? wSt.actors?.[this._viewerActorId] : wSt.actors?.husband;
      const hereSt = wSt.places?.[meSt?.location];
      if (hereSt && /街|巷|市|桥头|码头/.test(String(hereSt.name || ''))) {
        const vendors = Object.values(wSt.actors || {}).filter((a) => a && !a.dead && a.stall && a.location === meSt.location);
        if (vendors.length) {
          contextHintEarly += `（【街边摊子】${vendors.map((v) => `${v.name}卖${v.stall.word}（约${Number(v.stall.price).toFixed(2)}两）`).join('；')}。要买就照这些摊子写，别编出没有的摊。）\\n`;
        }
      }
    } catch { /* 忽略 */ }

""" + anchor
if '街边摊子' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 街上摊子进天道事实')
