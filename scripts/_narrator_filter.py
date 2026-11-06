import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        for (const seg of segs) {
          const m = seg.match(/^【([^】\\n]{1,12})】/);
          if (!m) { kept.push(seg); continue; }"""
new = """        for (const seg of segs) {
          const m = seg.match(/^【([^】\\n]{1,12})】/);
          if (!m) { kept.push(seg); continue; }
          // 旁白式说话人（客卿·府中/系统/数据库…）不是人，整段剔掉
          if (/客卿|府中|系统|数据库|天机局/.test(m[1]) && !Object.values(wOut.actors || {}).some((a) => a && a.name && m[1].includes(a.name))) {
            dropped.push(m[1]);
            continue;
          }"""
if old in s and '旁白式说话人' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('剔旁白说话人')
