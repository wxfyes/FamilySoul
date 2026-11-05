import io
p = 'src/world/places-target.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  { key: '官仓', test: /官仓|仓|库房/ },"""
new = """  { key: '祠堂', test: /祠堂|家庙/ },
  { key: '马厩', test: /马厩|马房|车马/ },
  { key: '库房', test: /库房|柴房|官仓|仓/ },"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 补祠堂/马厩/库房语义')

old2 = """  if (/房|厢|院|阁|厨|库|屋/.test(text)) {"""
new2 = """  if (/房|厢|院|阁|厨|库|屋|祠|厩/.test(text)) {"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 室内词补祠/厩')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# 眷属/下人安置：不只认 home===root，也认"住在该宅某院"
p2 = 'src/world/residence.js'
t = io.open(p2, encoding='utf-8-sig').read()
old3 = """    if (a.home !== rootId && a.location !== rootId && a.location !== a.home) continue;

    // 眷属按位份住"""
new3 = """    const livesHere = a.home === rootId
      || a.location === rootId
      || (a.home && world.places?.[a.home]?.parent === rootId)
      || (a.location && world.places?.[a.location]?.parent === rootId)
      || (root.owner === 'husband' && (a.household || a.spouse === 'husband'));
    if (!livesHere) continue;

    // 眷属按位份住"""
if old3 in t:
    t = t.replace(old3, new3, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('③ 安置范围放宽到"住在这座宅子里"')
