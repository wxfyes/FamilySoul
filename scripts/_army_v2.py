import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：账上私兵落到兵营名册（真人）"
add = """      // 一次性：私兵没补够的，补齐到账上兵额
      try {
        if (world.flags?.privateArmyV2 !== true) {
          const troops = Number(world.factions?.wangjia?.troops) || 0;
          const have = Object.values(world.actors || {}).filter((a) => a && !a.dead && /私兵/.test(String(a.role || ''))).length;
          const need = Math.max(0, troops - have);
          const barrackId = Object.keys(world.places || {}).find((id) => /兵营|校场|后营/.test(String(world.places[id]?.name || ''))) || 'street';
          const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
          let made = 0;
          for (let i = 0; i < need; i += 1) {
            let nm = fallbackName(world, 'male') || `王勇${['二','三','四','五','六','七','八','九'][i % 8]}`;
            if (usedNames.has(nm)) nm = `${nm}郎`;
            usedNames.add(nm);
            const id = `wangjia_soldier_${Date.now()}_${i}`;
            world.actors[id] = {
              id, name: nm, role: '私兵', title: '私兵', gender: 'male',
              age: 20 + Math.floor(Math.random() * 12), home: barrackId, location: barrackId,
              money: 0.5, relations: {}, origin: 'private_army', faction: 'wangjia',
            };
            made += 1;
          }
          world.flags = world.flags || {};
          world.flags.privateArmyV2 = true;
          if (made) console.log(`[Army] 私兵补齐：${made} 人`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'privateArmyV2' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 补兵迁移')
