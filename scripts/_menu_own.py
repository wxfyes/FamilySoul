import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const places = Object.entries(world.places || {})
          .filter(([id, pl]) => id !== curId && pl && pl.name && !pl.private)
          .map(([id, pl]) => ({ id, name: pl.name, names: occupied[id] || [], count: (occupied[id] || []).length, near: nearScore([id, pl]) }))
          .sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'))
          .slice(0, 400);"""
new = """        // 私宅里的院子只列"自己这座宅子"的；公共地点全列
        const places = Object.entries(world.places || {})
          .filter(([id, pl]) => {
            if (id === curId || !pl || !pl.name || pl.private) return false;
            if (pl.parent) return pl.parent === myHome || pl.parent === curId;
            return true;
          })
          .map(([id, pl]) => ({ id, name: pl.name, names: occupied[id] || [], count: (occupied[id] || []).length, near: nearScore([id, pl]) }))
          .sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'))
          .slice(0, 400);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('私宅院子只列自家的')
