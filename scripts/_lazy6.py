import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          .sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'))
          .slice(0, 400);"""
new = """          .sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'))
          .slice(0, 400);

        // 院子平时只记在父地点的账上（不占地点表）；列菜单时按 id 补进来，人真去了才展开
        try {
          const wantedParents = new Set([myHome, curId].filter(Boolean));
          for (const pid of wantedParents) {
            const parent = world.places?.[pid];
            if (!parent?.rooms) continue;
            const houseName = String(parent.name || '').split('·').slice(0, 2).join('·');
            for (const [key, rec] of Object.entries(parent.rooms)) {
              if (!rec || !rec.id) continue;
              if (world.places[rec.id]) continue;   // 已展开的已经在列表里
              if (places.some((x) => x.id === rec.id)) continue;
              places.push({
                id: rec.id,
                name: `${houseName}·${rec.name}`,
                names: occupied[rec.id] || [],
                count: (occupied[rec.id] || []).length,
                near: 1,
              });
            }
            places.sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'));
          }
        } catch { /* 忽略 */ }"""
if old in s and '院子平时只记在父地点的账上' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('⑦ 菜单补上"账上的院子"')
