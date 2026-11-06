import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进"""
new = """        // 说的是本城某个地方（集市/客栈/米行…）：先在本城找，不要跑到临江去
        try {
          const labelOf2 = (nm) => {
            const seg = String(nm || '').split('·')[0];
            return /府$|州$|县$/.test(seg) ? seg : '临江府';
          };
          const meNow0 = world.actors?.[actorId] || world.actors?.husband;
          const myCity2 = labelOf2(world.places?.[meNow0?.location]?.name);
          const alreadyCity = /府|州|县/.test(String(target));
          if (!alreadyCity) {
            const hit = Object.entries(world.places || {}).find(([, pl]) => pl && pl.name
              && labelOf2(pl.name) === myCity2 && String(pl.name).split('·').slice(1).join('·').includes(target));
            if (hit) target = hit[0];
          }
        } catch { /* 忽略 */ }

        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进"""
if old in s and '先在本城找' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('go 本城优先')
