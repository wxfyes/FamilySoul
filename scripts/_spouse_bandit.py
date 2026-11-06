import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：护院家丁按账上兵额收口，多出来的遣散自谋出路"
add = """      // 一次性：婚姻字段收口（相公不挂单一配偶）+ 家仆只留本宅的 + 先起两股匪患
      try {
        if (!world.flags?.spouseHouseFixV1) {
          const h = world.actors?.husband;
          if (h?.spouse) h.spouse = null;
          let cleaned = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (!a.household) continue;
            const homeName = String(world.places?.[a.home]?.name || '');
            if (homeName.startsWith('临江·王宅')) continue;
            a.household = false;
            cleaned += 1;
          }
          // 先起两股匪，免得剿匪时"没有匪患"
          world.bandits = world.bandits && typeof world.bandits === 'object' ? world.bandits : {};
          if (Object.keys(world.bandits).length === 0) {
            const day = Number(world.clock?.day) || 1;
            const seeds = [
              { id: `bandit_临江府_${day}_a`, name: '临江府水匪', kind: 'water', strength: 10, homeCity: '临江府' },
              { id: `bandit_临江府_${day}_b`, name: '运河两岸散匪', kind: 'water', strength: 7, homeCity: '临江府' },
            ];
            for (const b of seeds) {
              world.bandits[b.id] = {
                ...b, region: world.cities?.临江府?.region || '江南',
                leader: '匪首', tier: 1,
                silver: Math.round(b.strength * 0.5 * 100) / 100,
                grain: Math.round(b.strength * 1.2 * 100) / 100,
                infamy: 25, createdDay: day,
              };
            }
            console.log('[Bandit] 起两股匪患供剿');
          }
          world.flags = world.flags || {};
          world.flags.spouseHouseFixV1 = { at: Date.now(), cleaned };
          console.log(`[House] 家仆收口：清 ${cleaned} 人；相公配偶字段已清空`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'spouseHouseFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('婚姻/家仆/匪患迁移')
