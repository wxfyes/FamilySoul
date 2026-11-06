import io
# ① 案情只从"这座城"的人里选
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const pool = Object.values(w.actors || {})
        .filter((a) => a && !a.dead && !a.jailed && a.id !== 'husband' && !a.playerControlled)"""
new = """      const cityLabel = (nm) => { const seg = String(nm || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; };
      const pool = Object.values(w.actors || {})
        .filter((a) => a && !a.dead && !a.jailed && a.id !== 'husband' && !a.playerControlled)
        // 案子只在这座城里发生：别把外城的人拉来顶案
        .filter((a) => cityLabel(w.places?.[a.location]?.name) === String(pend.city || ''))"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 案情限本城')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② 每城一个商会（乡绅当会首）
p2 = 'src/world/city.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """  world.flags.cityBase[city] = { at: Date.now(), streetId, marketId, innId, tier, people, jobs };"""
new2 = """  // 商会：每城一个，会首由乡绅出任（行会里的事由他去张罗）
  try {
    world.guilds = world.guilds || {};
    if (!world.guilds[city]) {
      const chief = world.actors?.[`${slug}_notable_乡绅`];
      world.guilds[city] = {
        name: `${city}商会`, city,
        head: chief?.id || null, headName: chief?.name || '',
        dues: tier >= 3 ? 3 : 2, attitude: 'neutral',
      };
    }
  } catch { /* 忽略 */ }

  world.flags.cityBase[city] = { at: Date.now(), streetId, marketId, innId, tier, people, jobs };"""
if old2 in t and '商会' not in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 每城商会')
