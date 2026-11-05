import io

p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 废掉每日扣饷，只保留每日吃粮
old_run = """    const pay = round2(total * PAY_PER_DAY);
    const grainNeed = round2(total * GRAIN_PER_DAY);"""
new_run = """    // 日常只吃粮，不发饷（放饷是每月一次的事）
    const grainNeed = round2(total * GRAIN_PER_DAY);"""
if old_run in s:
    s = s.replace(old_run, new_run, 1)
    print('① 废除每日扣饷')

old_paid = """    let paid = spendFactionSilver(world, f, pay);

    if (paid && fed) f.morale = Math.min(100, Math.round(num(f.morale) + 1));
    else {
      f.morale = Math.max(0, Math.round(num(f.morale) - (paid ? 3 : 6)));
      if (!fed) fire(world, { action: 'army_hungry', actor: f.leader, place: null, payload: { text: `${f.name}军中缺粮，士气跌落` } });
      if (!paid) fire(world, { action: 'army_unpaid', actor: f.leader, place: null, payload: { text: `${f.name}欠饷，营中怨声四起` } });
    }"""
new_paid = """    // 粮够 → 士气稳；粮不够 → 掉士气（饷另算，见放饷日）
    if (fed) f.morale = Math.min(100, Math.round(num(f.morale) + 1));
    else {
      f.morale = Math.max(0, Math.round(num(f.morale) - 4));
      fire(world, { action: 'army_hungry', actor: f.leader, place: null, payload: { text: `${f.name}军中缺粮，士气跌落` } });
    }"""
if old_paid in s:
    s = s.replace(old_paid, new_paid, 1)
    print('② 军需改为只管吃粮')

# ② 增加：放饷日 + 欠饷状态机 + 补饷
if 'export function runPayday' not in s:
    s = s.replace("/** 每月饷银与口粮（给面板显示） */", """/**
 * 放饷日：每月初一（day % 30 === 0）
 * 银够 → 足额放饷，士气振；银不够 → 欠饷，记录月数与欠额
 * 欠饷 1 月：怨声四起（士气 -15）
 * 欠饷 2 月：开小差（逃 10%，折损军械）
 * 欠饷 3 月以上：哗变（逃 25%，可能会反噬）
 */
export function runPayday(world, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return [];
  const out = [];

  for (const f of Object.values(world.factions || {})) {
    if (!f) continue;
    const troops = totalTroops(world, f);
    if (troops <= 0) continue;

    const due = round2(troops * MONTHLY_PAY);
    f.arrears = f.arrears && typeof f.arrears === 'object' ? f.arrears : { months: 0, owed: 0 };

    if (spendFactionSilver(world, f, due)) {
      f.morale = Math.min(100, Math.round(num(f.morale) + 6));
      if (f.arrears.months > 0) {
        out.push({ action: 'pay_arrears_clear', actor: f.leader, place: null, payload: { text: `${f.name}补清积欠，营中欢声雷动` } });
      } else {
        out.push({ action: 'payday', actor: f.leader, place: null, payload: { text: `${f.name}放饷 ${due} 两，军心大定` } });
      }
      f.arrears = { months: 0, owed: 0 };
      continue;
    }

    // 欠饷
    f.arrears.months += 1;
    f.arrears.owed = round2(num(f.arrears.owed) + due);
    f.morale = Math.max(0, Math.round(num(f.morale) - 15));
    out.push({ action: 'arrears', actor: f.leader, place: null, payload: { text: `${f.name}欠饷 ${f.arrears.months} 月（欠 ${f.arrears.owed} 两），营中怨声四起` } });

    if (f.arrears.months >= 2) {
      const town = Object.keys(f.stationed || {})[0];
      if (town) {
        const flee = Math.max(1, Math.round(num(f.stationed[town]) * 0.1));
        setStationed(world, f, town, Math.max(0, troopsAt(world, f, town) - flee));
        f.gear = f.gear || {};
        if (Number(f.gear.weapon) > 0) f.gear.weapon = Math.max(0, Math.round(f.gear.weapon - flee));
        out.push({ action: 'desert', actor: f.leader, place: town, payload: { text: `${f.name}欠饷日久，逃兵 ${flee} 人，典当了部分兵甲` } });
      }
    }
    if (f.arrears.months >= 3) {
      const town = Object.keys(f.stationed || {})[0];
      if (town) {
        const flee = Math.max(1, Math.round(num(f.stationed[town]) * 0.25));
        setStationed(world, f, town, Math.max(0, troopsAt(world, f, town) - flee));
        f.morale = 20;
        out.push({ action: 'mutiny', actor: f.leader, place: town, payload: { text: `${f.name}欠饷三月，营中哗变，溃散 ${flee} 人` } });
        try {
          if (world.cities?.[town]) world.cities[town].unrest = Math.min(100, num(world.cities[town].unrest) + 10);
        } catch { /* 忽略 */ }
      }
    }
  }
  return out;
}

/** 补发积欠军饷：有钱就能补，补完士气回血 */
export function payArrears(world, fid) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const ar = f.arrears || { months: 0, owed: 0 };
  if (!(Number(ar.owed) > 0)) return { ok: false, error: '并不欠饷' };
  if (!spendFactionSilver(world, f, Number(ar.owed))) {
    return { ok: false, error: `银不够：欠 ${ar.owed} 两，手头 ${round2(factionSilver(world, f))} 两` };
  }
  f.arrears = { months: 0, owed: 0 };
  f.morale = Math.min(100, Math.round(num(f.morale) + 20));
  return { ok: true, paid: round2(Number(ar.owed)), morale: f.morale };
}

/** 每月饷银与口粮（给面板显示） */""", 1)
    print('③ 加放饷日与欠饷状态机')

# 月饷仍是 1 两/兵/月；PAY_PER_DAY 不再使用，注明保留只为兼容
s = s.replace("export const PAY_PER_DAY = MONTHLY_PAY / 30;", "export const PAY_PER_DAY = 0;   // 已废：饷按月放，不走每日结算")
io.open(p, 'w', encoding='utf-8-sig').write(s)
