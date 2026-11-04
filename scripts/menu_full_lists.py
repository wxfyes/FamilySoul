import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 地点：全城名册都列出来（有人的排前面），不再只列"有人气"的
old = """        const occupied = {};
        for (const a of people) {
          if (!a.location || !a.name) continue;
          occupied[a.location] = occupied[a.location] || [];
          if (occupied[a.location].length < 4) occupied[a.location].push(a.name);
        }
        const places = Object.entries(occupied)
          .map(([id, names]) => ({ id, name: placeName(id), names }))
          .filter((x) => x.id !== curId)
          .sort((x, y) => y.names.length - x.names.length)
          .slice(0, 12);"""
new = """        const occupied = {};
        for (const a of people) {
          if (!a.location || !a.name) continue;
          occupied[a.location] = occupied[a.location] || [];
          if (occupied[a.location].length < 3) occupied[a.location].push(a.name);
        }
        // 全城名册都算可去：有人的排前面，其次按名字排；私密房间（客栈房）不进公共列表
        const places = Object.entries(world.places || {})
          .filter(([id, pl]) => id !== curId && pl && pl.name && !pl.private)
          .map(([id, pl]) => ({ id, name: pl.name, names: occupied[id] || [], count: (occupied[id] || []).length }))
          .sort((x, y) => (y.count - x.count) || x.name.localeCompare(y.name, 'zh'))
          .slice(0, 60);"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 地点改成全城名册')

# ② 找人：不再截断到 40，全列出来（分组仍按视角）
old2 = """          .sort((x, y) => {
            const o = isHusbandViewer
              ? { 府内: 0, 相好: 1, 其他人: 2 }
              : { 我的人: 0, 王家: 1, 其他人: 2 };
            const ax = o[x.group] ?? 9;
            const ay = o[y.group] ?? 9;
            if (ax !== ay) return ax - ay;
            return y.trust - x.trust;
          })
          .slice(0, 40);"""
new2 = """          .sort((x, y) => {
            const o = isHusbandViewer
              ? { 府内: 0, 相好: 1, 其他人: 2 }
              : { 我的人: 0, 王家: 1, 其他人: 2 };
            const ax = o[x.group] ?? 9;
            const ay = o[y.group] ?? 9;
            if (ax !== ay) return ax - ay;
            // 同组：在跟前的排前，其次信任高的
            if (x.here !== y.here) return x.here ? -1 : 1;
            return y.trust - x.trust;
          })
          .slice(0, 120);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 找人不再截断到 40')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
