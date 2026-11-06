import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          const neighbors = Object.values(world.actors || {}).filter((x) => x && !x.dead
            && !x.household && !String(x.id).startsWith('usr_') && x.id !== actorId"""
new = """          const neighbors = Object.values(world.actors || {}).filter((x) => x && !x.dead
            && !x.humanBound && !x.household && !String(x.id).startsWith('usr_') && x.id !== actorId"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 邻居排除真人绑定角色')
