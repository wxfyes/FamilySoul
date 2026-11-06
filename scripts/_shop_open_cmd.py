import io
# ③ 相公说"开业/开张"：自己名下筹备中的铺子当场开门
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.79 说亲：话里点名"
add = """    // 8.785 开业：名下筹备中的铺子，相公一句话就开张
    try {
      if (/开业|开张|开门做生意|挂匾/.test(String(sayText || ''))) {
        const wO = loadState(this.dataDir);
        const meO = wO.actors?.[this._viewerActorId || 'husband'] || wO.actors?.husband;
        const mine = (wO.assets?.properties || []).filter((p) => p && (String(p.owner || '') === String(meO?.id) || String(p.keeper || '') === String(meO?.id)));
        const closed = mine.filter((p) => !['已开张', '正常营业'].includes(String(p.status || '')));
        if (closed.length) {
          for (const p of closed) { p.status = '已开张'; p.openedDay = wO.clock?.day || 1; }
          saveState(this.dataDir, wO);
          reply += `\\n（${closed.map((p) => p.name).join('、')} 今日开张了。）`;
          console.log(`[Shop] 相公令下开张：${closed.map((p) => p.name).join('、')}`);
        }
      }
    } catch { /* 忽略 */ }

""" + anchor
if '相公令下开张' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 开业指令')
