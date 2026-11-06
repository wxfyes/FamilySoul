import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.7855 货与赌"
add = """    // 8.7848 叫人来：话里点名"让/叫/请 某人 来"，引擎把人挪到跟前
    try {
      const mCall = /(?:让|叫|请|唤)\\s*([\\u4e00-\\u9fa5]{2,4})\\s*(?:来|到|过来|上前)/.exec(String(sayText || ''));
      if (mCall) {
        const wC = loadState(this.dataDir);
        const meC = wC.actors?.[this._viewerActorId || 'husband'] || wC.actors?.husband;
        const target = Object.values(wC.actors || {}).find((a) => a && !a.dead && a.name === mCall[1]);
        if (target && target.location !== meC?.location) {
          const mv = moveActor(wC, target.id, meC.location, 'world', '叫到跟前');
          if (mv?.ok) {
            saveState(this.dataDir, wC);
            reply += `\\n（${target.name}应声到跟前来了。）`;
          } else {
            reply += `\\n（${target.name}一时过不来：${mv?.error || '路不通'}。）`;
          }
        }
      }
    } catch (err) { console.warn('[Summon] 叫人来失败：', err.message); }

""" + anchor
if '8.7848 叫人来' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('叫人来')
