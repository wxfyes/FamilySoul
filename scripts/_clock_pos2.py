import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    if (actor && meetPlace) actor.location = meetPlace;"
new = "    if (actor && meetPlace) moveActor(world, actor.id, meetPlace, 'world', '赴约');"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('最后一处改为 moveActor')
