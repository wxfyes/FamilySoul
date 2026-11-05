import io

# ============ 第三支柱：营兵门槛 + 哗变反噬 ============
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()

# 营兵门槛：需据城或受朝命
old = """  const k = RECRUIT_KINDS[kind] || RECRUIT_KINDS.guard;
  const cost = round2(come * k.cost);"""
new = """  const k = RECRUIT_KINDS[kind] || RECRUIT_KINDS.guard;

  // 私蓄甲士等同谋逆：营兵须据城或受朝命
  if (kind === 'army') {
    const hasCity = Array.isArray(f.cities) && f.cities.length > 0;
    const hasOffice = Boolean(world.court?.offices && Object.values(world.court.offices).some((o) => o && o.holder === f.leader));
    if (!hasCity && !hasOffice) {
      return { ok: false, error: '未奉朝命、未据城池，擅募野战营兵形同聚众谋逆！眼下只可招家丁与护院。' };
    }
  }

  const cost = round2(come * k.cost);"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 营兵门槛')

# 哗变反噬：30% 概率洗劫驻地粮与府库
old_mutiny = """        setStationed(world, f, town, Math.max(0, troopsAt(world, f, town) - flee));
        f.morale = 20;
        out.push({ action: 'mutiny', actor: f.leader, place: town, payload: { text: `${f.name}欠饷三月，营中哗变，溃散 ${flee} 人` } });
        try {
          if (world.cities?.[town]) world.cities[town].unrest = Math.min(100, num(world.cities[town].unrest) + 10);
        } catch { /* 忽略 */ }"""
new_mutiny = """        setStationed(world, f, town, Math.max(0, troopsAt(world, f, town) - flee));
        f.morale = 20;
        let lootText = '';
        // 溃兵啸聚：三成概率洗劫军粮与府库
        if (Math.random() < 0.3) {
          try {
            const ct = world.cities?.[town];
            if (ct && num(ct.grain) > 0) {
              const takeGrain = Math.min(num(ct.grain), 50);
              ct.grain = round2(num(ct.grain) - takeGrain);
              lootText += `劫走军粮 ${takeGrain} 石；`;
            }
            const lootSilver = Math.min(num(world.assets?.silver), 50);
            if (lootSilver > 0) {
              world.assets.silver = round2(num(world.assets.silver) - lootSilver);
              lootText += `掠去府库 ${lootSilver} 两；`;
            }
          } catch { /* 忽略 */ }
        }
        out.push({ action: 'mutiny', actor: f.leader, place: town, payload: { text: `${f.name}欠饷三月，营中哗变，溃散 ${flee} 人${lootText ? `，${lootText}` : ''}` } });
        try {
          if (world.cities?.[town]) world.cities[town].unrest = Math.min(100, num(world.cities[town].unrest) + 10);
        } catch { /* 忽略 */ }"""
if old_mutiny in s:
    s = s.replace(old_mutiny, new_mutiny, 1)
    print('② 哗变反噬')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ 第一支柱：中馈月例银 ============
p2 = 'src/world/clock.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'runHouseholdPayday' not in t:
    t = t.replace("function runAllowances(world, events) {", """/** 中馈月例：每月初一，公中拨银给主母操持内宅 */
function runHouseholdPayday(world, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return;
  world.assets = world.assets && typeof world.assets === 'object' ? world.assets : {};
  const allowance = Number(world.assets.householdAllowance) || 4.0;
  world.assets.householdAllowance = allowance;
  const ar = world.assets.householdArrears = world.assets.householdArrears || { months: 0, owed: 0 };
  const silver = Number(world.assets.silver) || 0;

  const mistresses = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.household);
  if (!mistresses.length) return;

  if (silver >= allowance + Number(ar.owed || 0)) {
    const total = Math.round((allowance + Number(ar.owed || 0)) * 100) / 100;
    world.assets.silver = Math.round((silver - total) * 100) / 100;
    const hadArrears = Number(ar.months) > 0;
    ar.months = 0;
    ar.owed = 0;
    for (const a of mistresses) {
      const rel = a.relations?.husband;
      if (rel) {
        rel.grievance = Math.max(0, Math.round((Number(rel.grievance) || 0) - 5));
        rel.trust = Math.min(100, Math.round((Number(rel.trust) || 50) + (hadArrears ? 3 : 1)));
      }
    }
    events.push(nextEvent(world, {
      action: 'household_payday', actor: 'husband', place: 'husband_room',
      payload: { text: hadArrears ? `公中拨足银两并补齐旧欠，内宅欢欣` : `月初发下公中月例银 ${allowance} 两，内宅井井有条` },
      isPublic: false,
    }));
    return;
  }

  // 发不出：欠
  ar.months = Number(ar.months) + 1;
  ar.owed = Math.round((Number(ar.owed) + allowance) * 100) / 100;
  const g = ar.months >= 3 ? 15 : ar.months === 2 ? 10 : 5;
  for (const a of mistresses) {
    const rel = a.relations?.husband;
    if (rel) {
      rel.grievance = Math.min(100, Math.round((Number(rel.grievance) || 0) + g));
      if (ar.months >= 3) rel.trust = Math.max(0, Math.round((Number(rel.trust) || 50) - 15));
    }
  }
  const text = ar.months >= 3
    ? '公中三月未拨月例，丫鬟告假离府，内宅生计维艰'
    : ar.months === 2
      ? '公中两月未发月钱，下人私下私语家道中落，炭火减半'
      : '公中银两短缺，月例未发，主母暗中典当贴补米面';
  events.push(nextEvent(world, {
    action: 'household_arrears', actor: 'husband', place: 'husband_room',
    payload: { text }, isPublic: ar.months >= 2,
  }));
}

function runAllowances(world, events) {""", 1)

    # 每月初一调用
    anchor = """  // 每月：士林清议、宗族走动（都只说事实，不写台词）"""
    add = """  // 每月初一：中馈月例（公中拨银给主母操持内宅）
  try {
    runHouseholdPayday(world, events);
  } catch (err) {
    console.warn('[Household] 中馈结算失败：', err.message);
  }

""" + anchor
    if anchor in t:
        t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('③ 中馈月例')
