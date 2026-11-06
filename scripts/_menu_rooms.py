import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          const wantedParents = new Set([myHome, curId].filter(Boolean));"""
new = """          // 名下院子：自家 + 当前这处 + 同城里开门做生意的（酒楼/茶坊/衙署），这样"雅阁"能搜到
          const wantedParents = new Set([myHome, curId].filter(Boolean));
          try {
            for (const [pid, pl] of Object.entries(world.places || {})) {
              if (!pl || !pl.rooms) continue;
              if (wantedParents.has(pid)) continue;
              const sameCity = curPlace?.city && pl.city && pl.city === curPlace.city;
              const publicPlace = pl.use === 'restaurant' || pl.use === 'shop' || pl.use === 'court'
                || /酒楼|茶坊|茶栈|客栈|衙署|县衙|码头/.test(String(pl.name || ''));
              if (sameCity && publicPlace) wantedParents.add(pid);
            }
          } catch { /* 忽略 */ }"""
if old in s and '雅阁' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 菜单补同城公开场所的院子')
