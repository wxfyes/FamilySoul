import io
# ① 待办里一律用"人名的名字"，不再把 id 当名字
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            kind: '约定', id: ap.id || `${ap.day}-${ap.hour}-${ap.name}`,
            when: `第${ap.day}日${ap.hour}时`, who: ap.name || '',"""
new = """            kind: '约定', id: ap.id || `${ap.day}-${ap.hour}-${ap.name}`,
            when: `第${ap.day}日${ap.hour}时`,
            who: (ap.actorId && world.actors?.[ap.actorId]?.name) || ap.name || '',"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 待办按 id 取名')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② 造约定时永远存人名（存 id 会漏到界面上）
p2 = 'src/world/dispatch.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """          name: actor?.name || String(args.who || '').slice(0, 12),"""
new2 = """          name: actor?.name || (world.actors?.[String(args.who || '')]?.name) || String(args.who || '').slice(0, 12),"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('② 造约定存人名')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
