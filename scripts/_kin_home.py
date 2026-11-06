import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：侧室住东厢、别在街上晃；仪式状态归端庄"
add = """      // 一次性：本宅内眷被支到外头的，收回府里（家在哪，人就该在哪）
      try {
        if (!world.flags?.kinHomeFixV1) {
          const moved = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const isKin = String(a.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷/.test(String(a.role || ''));
            if (!isKin) continue;
            const homeName = String(world.places?.[a.home]?.name || '');
            if (!homeName.startsWith('临江·王宅')) continue;
            const hereName = String(world.places?.[a.location]?.name || '');
            if (hereName.startsWith('临江·王宅')) continue;
            a.location = a.home;
            moved.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.kinHomeFixV1 = { at: Date.now(), moved };
          if (moved.length) console.log(`[Space] 内眷收回府里：${moved.join('、')}`);
        }
      } catch { /* 忽略 */ }

"""
if 'kinHomeFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('kin home fix')
