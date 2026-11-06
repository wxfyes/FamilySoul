import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：阶级人物被挪进王宅/住错府的，按 id 归回本家府邸"
add = """      // 一次性：府内名分与住处对齐（正妻正房、侧室东厢、丫鬟下房）
      try {
        if (!world.flags?.innerRankFixV1) {
          const east = Object.keys(world.places || {}).find((id) => /mansion_east/.test(id));
          const west = Object.keys(world.places || {}).find((id) => /mansion_west|servant_utility/.test(id));
          const fixed = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const role = String(a.role || '');
            if (/正妻/.test(role) && world.places?.husband_room) {
              a.home = 'husband_room';
              a.location = 'husband_room';
            } else if (/如夫人|二房|侧室|妾|姨娘|通房/.test(role) && east) {
              a.home = east; a.location = east; fixed.push(a.name);
            } else if (/丫鬟|丫头/.test(role) && west) {
              a.home = west; a.location = west; fixed.push(a.name);
            }
          }
          world.flags = world.flags || {};
          world.flags.innerRankFixV1 = { at: Date.now(), fixed };
          if (fixed.length) console.log(`[Rank] 内眷归位：${fixed.join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 一次性：被暗号误结算的侧室，亲密状态归零（没真到那一步）
      try {
        if (!world.flags?.sideIntimacyFixV1) {
          let n = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (String(a.spouse || '') !== 'husband') continue;
            if (/正妻/.test(String(a.role || ''))) continue;
            if (!a.intimacy?.consummated) continue;
            a.intimacy.consummated = false;
            a.intimacy.level = 0;
            a.intimacy.lastAt = 0;
            a.intimacy.ritual = 'solemn';
            n += 1;
            console.log(`[Intimacy] ${a.name} 亲密状态归零（未真到那一步）`);
          }
          world.flags = world.flags || {};
          world.flags.sideIntimacyFixV1 = { at: Date.now(), n };
        }
      } catch { /* 忽略 */ }

"""
if 'innerRankFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('内眷归位+亲密归零')
