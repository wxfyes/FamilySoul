import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：东家本钱（启动资金），只发一次，进流水"
add = """      // 一次性：户主关系落到人身上（谁家的人，归哪个户主管）
      try {
        if (!world.flags?.householdOwnerV1) {
          let n = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const kin = String(a.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷|家丁|护院|管事|管家/.test(String(a.role || ''));
            if (!kin) continue;
            if (a.householdOwner) continue;
            a.householdOwner = 'husband';
            n += 1;
          }
          world.flags = world.flags || {};
          world.flags.householdOwnerV1 = { at: Date.now(), n };
          if (n) console.log(`[House] 户主关系落籍：${n} 人归相公府`);
        }
      } catch { /* 忽略 */ }

"""
if 'householdOwnerV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('户主迁移')
