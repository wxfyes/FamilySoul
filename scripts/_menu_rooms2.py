import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """              if (sameCity && publicPlace) wantedParents.add(pid);"""
new = """              if (publicPlace) wantedParents.add(pid);   // 公开营业的地方，不论在哪个城都能搜到它的雅阁/雅间"""
if old in s:
    s = s.replace(old, new, 1)
    s = s.replace("""              if (!pl || !pl.rooms) continue;""", """              if (!pl || !pl.rooms) continue;
              if (wantedParents.size > 80) break;""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 公开场所的院子不限城')
