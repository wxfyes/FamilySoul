import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① "回家"直接回家里的正房/中堂，而不是大门
old = """        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进"""
new = """        // 说"回家/回府"：回自己的正房，不是大门
        if (/回家|回府|回宅|回房|回屋/.test(target)) {
          const meH = world.actors?.[actorId];
          const homeId = meH?.home || 'husband_room';
          const homeP = world.places?.[homeId];
          const mainId = homeP?.rooms?.main?.id;
          if (mainId) {
            try {
              const { materializeRoom } = await import('./world/residence.js');
              target = materializeRoom(world, homeId, 'main') || homeId;
            } catch { target = mainId; }
          } else {
            target = homeId;
          }
        }
        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进"""
if old in s and '回自己的正房' not in s:
    s = s.replace(old, new, 1)
    print('① 回家直达正房')
io.open(p, 'w', encoding='utf-8-sig').write(s)
