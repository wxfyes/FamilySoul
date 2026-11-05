import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进
        {
          const person = Object.values(world.actors || {}).find(
            (a) => a && !a.dead && a.name && (a.name === target || target.includes(a.name)),
          );
          if (person && world.places?.[person.location] && person.name !== (String((world.actors?.[actorId] || world.actors?.husband)?.name || ''))) {
            target = person.location;
          }
        }
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';"""
new = """        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进
        {
          const meName = String((world.actors?.[actorId] || world.actors?.husband)?.name || '');
          const person = Object.values(world.actors || {}).find(
            (a) => a && !a.dead && a.name && a.name !== meName && (a.name === target || target.includes(a.name)),
          );
          if (person && world.places?.[person.location]) target = person.location;
        }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 修正初始化顺序')
