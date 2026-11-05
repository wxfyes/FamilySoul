import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find('  // 赈灾：国库出钱；出不起，灾民就自己想办法')
if start < 0:
    raise SystemExit('找不到赈灾段')
end = s.find('  // 国库见底：加税或欠俸', start)
if end < 0:
    raise SystemExit('找不到赈灾段结束')

new_block = '''  // 赈灾：地方与户部报灾索款 15 万两起，层层漂没七成半，实发不足三成
  try {
    const disasters = (events || []).filter((e) => e && e.action === 'disaster').length;
    if (disasters > 0) {
      const reliefDemand = disasters * 150000;

      if (Number(tr.silver) >= reliefDemand) {
        tr.silver = Math.round((Number(tr.silver) - reliefDemand) * 100) / 100;
        tr.lastExpense = Math.round((Number(tr.lastExpense) + reliefDemand) * 100) / 100;
        tr.detail.relief = reliefDemand;

        // 巨款层层漂没：七成半进了官员私囊（按官数分润，换算回民间两）
        const skimmedRelief = reliefDemand * 0.75;
        const holders = Object.values(world.court?.offices || {})
          .filter((o) => o && o.holder && !o.vacant)
          .map((o) => world.actors?.[o.holder])
          .filter((a) => a && !a.dead);
        if (holders.length) {
          const eachGraft = Math.round(((skimmedRelief / K) / holders.length) * 100) / 100;
          for (const a of holders) a.money = Math.round(((Number(a.money) || 0) + eachGraft) * 100) / 100;
          tr.detail.disasterGraftToOfficials = Math.round(skimmedRelief * 100) / 100;
          tr.detail.disasterGraftCivil = Math.round(eachGraft * holders.length * 100) / 100;
        }

        // 拨了巨款，可实发不足三成：灾民仍不稳
        for (const ct of Object.values(world.cities || {})) {
          if (ct) ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 1);
        }
        events.push(nextEvent(world, {
          action: 'relief_corrupt', actor: 'court', place: null,
          payload: { text: `朝廷拨下 ${reliefDemand} 两赈灾银，巨款层层漂没入私囊，实发不足三成` },
          isPublic: true,
        }));
      } else {
        // 国库拨不出：归零、暴烈加派、民变四起
        tr.silver = 0;
        tr.detail.relief = 0;
        world.flags = world.flags || {};
        world.flags.courtPressure = Math.min(100, (Number(world.flags.courtPressure) || 0) + 15);
        for (const ct of Object.values(world.cities || {})) {
          if (!ct) continue;
          ct.tax = Math.min(50, (Number.isFinite(Number(ct.tax)) ? Number(ct.tax) : 10) + 3);
          ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 8);
        }
        events.push(nextEvent(world, {
          action: 'relief_short', actor: 'court', place: null,
          payload: { text: '国库告罄无法拨出赈款，流民啸聚冲击官府，朝廷下旨强征加派' },
          isPublic: true,
        }));
      }
    }
  } catch (err) {
    console.warn('[Treasury] 赈灾结算异常:', err.message);
  }

'''

s = s[:start] + new_block + s[end:]
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('赈灾改为十五万两级并带七成半漂没')
