import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const places = Object.entries(world.places || {})
          .filter(([id, pl]) => id !== curId && pl && pl.name && !pl.private)
          .map(([id, pl]) => ({ id, name: pl.name, names: occupied[id] || [], count: (occupied[id] || []).length }))
          .sort((x, y) => (y.count - x.count) || x.name.localeCompare(y.name, 'zh'))
          .slice(0, 300);"""
new = """        // 先给"眼前这片"排前面：同宅的院子 → 同城 → 有人的 → 其它
        const curPlace = world.places?.[curId] || {};
        const myHome = world.actors?.[actorId]?.home || '';
        const nearScore = ([id, pl]) => {
          if (id === myHome) return 0;
          if (pl.parent && (pl.parent === curId || pl.parent === myHome)) return 1;
          if (pl.parent) return 2;
          if (curPlace.city && pl.city && pl.city === curPlace.city) return 3;
          return 4;
        };
        const places = Object.entries(world.places || {})
          .filter(([id, pl]) => id !== curId && pl && pl.name && !pl.private)
          .map(([id, pl]) => ({ id, name: pl.name, names: occupied[id] || [], count: (occupied[id] || []).length, near: nearScore([id, pl]) }))
          .sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'))
          .slice(0, 400);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('菜单按远近排序')
