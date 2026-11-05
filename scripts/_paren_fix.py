import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
bad = "      const safeSpeaker = actor ? actor.name : (world.actors?.[ap.name]?.name || String(ap.name || '')));"
good = "      const safeSpeaker = actor ? actor.name : (world.actors?.[ap.name]?.name || String(ap.name || ''));"
if bad in s:
    s = s.replace(bad, good, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('修掉多出来的右括号')
