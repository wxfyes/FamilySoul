import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

fn = """
/**
 * 月例：每月从家里银两给各房发月钱。
 * 给足了她们手头宽裕、怨气消；发不出，她们自己想办法——
 * 这层不写台词，只让"体面钱"真的存在。
 */
function runAllowances(world, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return;

  // 名分 → 月例
  const ALLOWANCE = [
    { re: /正妻|大娘子/, amount: 3.0 },
    { re: /如夫人|二房|侧室|妾/, amount: 2.0 },
    { re: /通房|贴身丫鬟|丫鬟|丫头/, amount: 0.5 },
  ];
  const OUTSIDER = 1.5;   // 外室（不入府，暗中给）
  const CHILD = 0.2;      // 每个孩子

  let total = 0;
  const lines = [];

  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    const role = String(a.role || '');
    let amount = 0;

    if (a.household) {
      const hit = ALLOWANCE.find((x) => x.re.test(role));
      amount = hit ? hit.amount : 0;
      // 府里孩子：每月 0.2
      if (Array.isArray(a.parents) && a.parents.length) amount += CHILD;
    } else {
      // 外室：已圆房且不是正经内眷
      const intimate = (a.intimacy && a.intimacy.consummated) || Number(a.relations?.husband?.trust) >= 60;
      if (intimate) amount = OUTSIDER;
    }
    if (amount <= 0) continue;

    total += amount;
    lines.push(`${a.name}${amount.toFixed(1)}`);
  }

  if (!lines.length) return;

  world.assets = world.assets || {};
  const silver = Number(world.assets.silver) || 0;

  if (silver >= total) {
    world.assets.silver = Math.round((silver - total) * 100) / 100;
    // 足额：发到个人手里，怨气消一点
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === 'husband') continue;
      const role = String(a.role || '');
      let amount = 0;
      if (a.household) {
        const hit = ALLOWANCE.find((x) => x.re.test(role));
        amount = hit ? hit.amount : 0;
        if (Array.isArray(a.parents) && a.parents.length) amount += CHILD;
      } else {
        const intimate = (a.intimacy && a.intimacy.consummated) || Number(a.relations?.husband?.trust) >= 60;
        if (intimate) amount = OUTSIDER;
      }
      if (amount <= 0) continue;
      a.money = Math.round(((Number(a.money) || 0) + amount) * 100) / 100;
      const rel = a.relations?.husband;
      if (rel) rel.grievance = Math.max(0, Math.round((Number(rel.grievance) || 0) - 1));
    }
    console.log(`[Allowance] 第${day}日发月例 ${total.toFixed(1)} 两：${lines.join('、')}`);
    events.push(nextEvent(world, {
      action: 'allowance', actor: 'husband', place: 'husband_room',
      payload: { text: `发月例 ${total.toFixed(1)} 两` }, isPublic: false,
    }));
  } else {
    // 发不出：每人怨气 +3，记账
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === 'husband') continue;
      const rel = a.relations?.husband;
      if (!rel) continue;
      const role = String(a.role || '');
      const inHouse = a.household || (a.intimacy && a.intimacy.consummated);
      if (!inHouse) continue;
      rel.grievance = Math.min(100, Math.round((Number(rel.grievance) || 0) + 3));
    }
    console.log(`[Allowance] 第${day}日银两不足，月例 ${total.toFixed(1)} 两发不出`);
    events.push(nextEvent(world, {
      action: 'allowance_arrears', actor: 'husband', place: 'husband_room',
      payload: { text: `月例发不出，各房皆有怨言` }, isPublic: false,
    }));
  }
}
"""
if 'runAllowances' not in s:
    anchor = "function runPersonalEconomy(world, events) {"
    s = s.replace(anchor, fn + "\n" + anchor, 1)
    print('① 加入 runAllowances')

if 'runAllowances(world, events);' not in s:
    s = s.replace("  runPersonalEconomy(world, events);", "  runPersonalEconomy(world, events);\n  runAllowances(world, events);", 1)
    print('② 接入每日结算')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
