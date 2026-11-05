import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """  const byUse = {};
  for (const r of Object.values(root.rooms)) byUse[r.use] = r.id;"""
new = """  const byUse = {};
  for (const r of Object.values(root.rooms)) byUse[r.use] = r.id;
  // 按房间身份直接取（正房/东厢/西厢/下房/倒座房…）
  const byKey = {};
  for (const [k, r] of Object.entries(root.rooms)) byKey[k] = r.id;"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 增加按 key 取房')

old2 = """      const rank = /正妻|大娘子/.test(String(a.role || '')) ? 'main'
        : /二房|如夫人|侧室|妾/.test(String(a.role || '')) ? 'east' : 'west';
      const room = byUse[rank] || byUse.main;"""
new2 = """      const rank = /正妻|大娘子/.test(String(a.role || '')) ? 'main'
        : /二房|如夫人|侧室|妾/.test(String(a.role || '')) ? 'east' : 'west';
      const room = byKey[rank] || byKey.main || byUse.bedroom;"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 眷属按房号取'

old3 = """    const room = byUse[hit.use] || byUse.servant || byUse.gatehouse;"""
new3 = """    const room = byKey[hit.use] || byUse[hit.use] || byKey.servant || byUse.servant || byKey.gatehouse;"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 下人按房号取')
io.open(p, 'w', encoding='utf-8-sig').write(s)
