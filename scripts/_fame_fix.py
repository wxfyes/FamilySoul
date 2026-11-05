import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        fame: { value: fameOf(world, actorId), tags: (world.actors?.[actorId]?.fame?.tags || []) },"
new = "        fame: { value: fameOf(world, me?.id || 'husband'), tags: (world.actors?.[me?.id || 'husband']?.fame?.tags || []) },"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('修 fame 取错 actorId（应是 me.id）')
