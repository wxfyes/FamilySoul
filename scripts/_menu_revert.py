import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
block = """        // 读菜单时顺手把自己的宅子补齐（有院子的立刻跳过）
        try {
          const myHomeId = world.actors?.[actorId]?.home;
          if (myHomeId) {
            const r = ensureResidence(world, myHomeId);
            const fixed = repairRooms(world, myHomeId);
            if (r.built || fixed) { saveState(DATA_DIR, world); }
          }
        } catch { /* 忽略 */ }

"""
if block in s:
    s = s.replace(block, "", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('撤掉菜单里的重建（太重，会把接口拖死）')
