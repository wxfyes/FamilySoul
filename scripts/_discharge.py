import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：户主关系只落在本宅的人身上"
add = """      // 一次性：护院家丁按账上兵额收口，多出来的遣散自谋出路
      try {
        if (!world.flags?.staffDischargeV1) {
          const troops = Number(world.factions?.wangjia?.troops) || 0;
          const kinds = world.factions?.wangjia?.kinds || {};
          const wantGuard = Number(kinds.guard) || Math.min(6, troops);
          const wantRetain = Math.max(0, troops - wantGuard);
          const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && /家丁|护院/.test(String(a.role || '') || String(a.title || '')));
          all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
          let keptGuard = 0;
          let keptRetain = 0;
          const fired = [];
          for (const a of all) {
            const isGuard = /家丁/.test(String(a.role || a.title || ''));
            if (isGuard && keptGuard < wantGuard) { keptGuard += 1; continue; }
            if (!isGuard && keptRetain < wantRetain) { keptRetain += 1; continue; }
            // 遣散：不再算府里人，成了街上的百姓
            a.role = '百姓';
            a.title = '百姓';
            a.servant = false;
            delete a.household;
            delete a.householdOwner;
            delete a.quarters;
            delete a.duty;
            a.location = 'street';
            fired.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.staffDischargeV1 = { at: Date.now(), keptGuard, keptRetain, fired: fired.length };
          console.log(`[Staff] 遣散 ${fired.length} 人，留 家丁${keptGuard}/护院${keptRetain}`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'staffDischargeV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('遣散迁移')
