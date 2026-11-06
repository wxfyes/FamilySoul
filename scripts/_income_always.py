import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (closed.length) {
          for (const p of closed) { p.status = '已开张'; p.openedDay = wO.clock?.day || 1; }
          try { refreshPropertyIncomes(wO); } catch { /* 忽略 */ }
          saveState(this.dataDir, wO);
          reply += `\\n（${closed.map((p) => p.name).join('、')} 今日开张了。）`;
          console.log(`[Shop] 相公令下开张：${closed.map((p) => p.name).join('、')}`);
        }"""
new = """        for (const p of closed) { p.status = '已开张'; p.openedDay = wO.clock?.day || 1; }
        try { refreshPropertyIncomes(wO); } catch { /* 忽略 */ }
        saveState(this.dataDir, wO);
        if (closed.length) {
          reply += `\\n（${closed.map((p) => p.name).join('、')} 今日开张了。）`;
          console.log(`[Shop] 相公令下开张：${closed.map((p) => p.name).join('、')}`);
        }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('开业总是重算')
