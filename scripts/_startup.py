import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：本宅内眷被支到外头的，收回府里（家在哪，人就该在哪）"
add = """      // 一次性：东家本钱（启动资金），只发一次，进流水
      try {
        if (!world.flags?.startupGrantV1 && world.assets) {
          const grant = 300;
          world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + grant) * 100) / 100;
          world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
          world.ledger.push({ day: world.clock?.day || 1, hour: world.clock?.hour || 0, delta: grant, title: '东家本钱（启动）', by: 'husband', balance: world.assets.silver });
          world.flags = world.flags || {};
          world.flags.startupGrantV1 = { at: Date.now(), grant };
          console.log(`[Money] 启动本钱 +${grant} 两，现银 ${world.assets.silver}`);
        }
      } catch { /* 忽略 */ }

"""
if 'startupGrantV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('启动资金')
