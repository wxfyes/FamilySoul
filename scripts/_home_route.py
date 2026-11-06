import io
# ① 回家：只有当目标是"城名"时才走城路由（别把"临江府·王甯的小院"当城名）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            const base = cn.replace(/府$|县$|州$/g, '');
            if (!target.includes(base) && !target.includes(cn)) continue;"""
new = """            const base = cn.replace(/府$|县$|州$/g, '');
            const t2 = String(target).trim();
            const isBareCity = t2 === cn || t2 === base || (!t2.includes('·') && t2.includes(cn));
            if (!isBareCity) continue;"""
if old in s and 'isBareCity' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① go 城路由收紧')

# ② places-target 同理
p2 = 'src/world/places-target.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """      if (!text.includes(base) && !text.includes(cn)) continue;"""
new2 = """      const t3 = text.trim();
      const bare = t3 === cn || t3 === base || (!t3.includes('·') && t3.includes(cn));
      if (!bare) continue;"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 语义层同理')
