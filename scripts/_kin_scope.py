import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：户主关系落到人身上"
add = """      // 一次性：户主关系只落在本宅的人身上；被误拉到厅上的外人送回原处
      try {
        if (!world.flags?.kinScopeFixV1) {
          let cleared = 0;
          let sentHome = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const homeName = String(world.places?.[a.home]?.name || '');
            const inEstate = homeName.startsWith('临江·王宅');
            if (a.householdOwner === 'husband' && !inEstate && String(a.spouse || '') !== 'husband') {
              delete a.householdOwner;
              cleared += 1;
            }
            const hereName = String(world.places?.[a.location]?.name || '');
            if (/议事厅/.test(hereName) && a.home && !inEstate && world.places?.[a.home]) {
              a.location = a.home;
              sentHome += 1;
            }
          }
          world.flags = world.flags || {};
          world.flags.kinScopeFixV1 = { at: Date.now(), cleared, sentHome };
          if (cleared || sentHome) console.log(`[House] 户主收口：清 ${cleared} 人，送回 ${sentHome} 人`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'kinScopeFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('户主收口迁移')
