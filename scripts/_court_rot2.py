import io

p = 'src/world/clock.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

idx = None
for i, line in enumerate(lines):
    if '国库见底：加税或欠俸' in line:
        idx = i
        break
if idx is None:
    raise SystemExit('找不到插入点')

block = '''  // 贪墨：截留的一部分进了官员自己的口袋（国库漏多少，官就肥多少）
  try {
    const holders = Object.values(world.court?.offices || {})
      .filter((o) => o && o.holder && !o.vacant)
      .map((o) => world.actors?.[o.holder])
      .filter((a) => a && !a.dead);
    if (skim > 0 && holders.length) {
      const each = Math.round((skim * 0.3 / holders.length) * 100) / 100;
      for (const a of holders) a.money = Math.round(((Number(a.money) || 0) + each) * 100) / 100;
      tr.detail.skimToOfficials = Math.round(each * holders.length * 100) / 100;
    }
  } catch { /* 忽略 */ }

  // 赈灾：国库出钱；出不起，灾民就自己想办法
  try {
    const disasters = (events || []).filter((e) => e && e.action === 'disaster').length;
    if (disasters > 0) {
      const relief = disasters * 5000;
      if (Number(tr.silver) >= relief) {
        tr.silver = Math.round((Number(tr.silver) - relief) * 100) / 100;
        tr.lastExpense = Math.round((Number(tr.lastExpense) + relief) * 100) / 100;
        tr.detail.relief = relief;
        for (const ct of Object.values(world.cities || {})) {
          if (ct) ct.unrest = Math.max(0, (Number(ct.unrest) || 0) - 2);
        }
      } else {
        tr.silver = 0;
        tr.detail.relief = 0;
        world.flags = world.flags || {};
        world.flags.courtPressure = Math.min(100, (Number(world.flags.courtPressure) || 0) + 5);
        for (const ct of Object.values(world.cities || {})) {
          if (ct) ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 4);
        }
        events.push(nextEvent(world, {
          action: 'relief_short', actor: 'court', place: null,
          payload: { text: '国库拨不出赈灾粮款，灾民聚于城外' }, isPublic: true,
        }));
      }
    }
  } catch { /* 忽略 */ }

'''

lines = lines[:idx] + block.split('\n') + lines[idx:]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('已插入贪墨与赈灾')
