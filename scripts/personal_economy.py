import io

# ============ ① state.js：私房钱初始值与迁移 ============
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

helper = """
/** 按身份给一笔起步私房钱（两）；已有钱的人不动 */
export function seedPersonalMoney(world) {
  const MONEY = {
    掌柜: [8, 30], 东家: [15, 40], 郎中: [4, 12], 镖头: [3, 10], 先生: [2, 6], 夫子: [2, 6],
    知县: [5, 20], 知府: [15, 40], 尚书: [40, 80], 宰相: [80, 150], 天子: [200, 500],
    伙计: [0.5, 2], 小二: [0.5, 2], 小厮: [0.3, 1.5], 丫鬟: [0.3, 1.5], 丫头: [0.3, 1.5],
    妇人: [1, 5], 寡妇: [1, 4], 绣娘: [0.8, 3], 农: [0.3, 1.5], 娘: [1, 5], 婆: [0.5, 2],
  };
  let seeded = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (typeof a.money === 'number') continue;
    const role = String(a.role || '');
    let base = [0.8, 3];
    for (const k of Object.keys(MONEY)) {
      if (role.includes(k)) { base = MONEY[k]; break; }
    }
    const rnd = (a.id || a.name || '').split('').reduce((h, c) => (h * 131 + c.charCodeAt(0)) >>> 0, 7) / 4294967295;
    a.money = Math.round((base[0] + (base[1] - base[0]) * rnd) * 100) / 100;
    seeded += 1;
  }
  if (seeded) console.log(`[Money] 给 ${seeded} 人补了私房钱`);
  return seeded;
}
"""
if 'seedPersonalMoney' not in s:
    anchor = "export function ensureCourt(world) {"
    s = s.replace(anchor, helper + "\n" + anchor, 1)
    print('① 加入 seedPersonalMoney')

# 放进迁移里，老存档自动补
anchor2 = "export function migrateOwnership(world) {"
if anchor2 in s and 'seedPersonalMoney(world)' not in s:
    s = s.replace(anchor2, anchor2 + "\n  try { seedPersonalMoney(world); } catch { /* 忽略 */ }", 1)
    print('② 迁移时自动补私房钱')

io.open(p, 'w', encoding='utf-8').write(s)

# ============ ② clock.js：每日个人收支 ============
p2 = 'src/world/clock.js'
c = io.open(p2, encoding='utf-8-sig').read()

fn = """
/**
 * 个人经济：每人每天有进项也有开销。
 * 不写台词，只让钱真的在流：有钱的攒、没钱的欠、欠多了会出事。
 */
function runPersonalEconomy(world, events) {
  const day = Number(world.clock?.day) || 1;
  let broke = 0;

  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (typeof a.money !== 'number') a.money = 1;

    const role = String(a.role || '');
    // ── 进项 ──
    let income = 0.02;                       // 兜底：打零工
    if (/天子/.test(role)) income = 3;
    else if (/宰相|尚书/.test(role)) income = 0.8;
    else if (/知府/.test(role)) income = 0.5;
    else if (/知县|县令/.test(role)) income = 0.35;
    else if (/巡检|都尉|统领|把总/.test(role)) income = 0.25;
    else if (/掌柜|东家/.test(role)) income = 0.4;
    else if (/郎中|大夫/.test(role)) income = 0.2;
    else if (/镖头|镖师/.test(role)) income = 0.15;
    else if (/先生|夫子|教书/.test(role)) income = 0.1;
    else if (/伙计|小二|小厮|跑堂/.test(role)) income = 0.06;
    else if (/丫鬟|丫头|嬷嬷/.test(role)) income = 0.03;
    else if (/绣娘|针线/.test(role)) income = 0.08;
    else if (/农|佃|田/.test(role)) income = 0.05;
    else if (/妇人|寡妇|婆|娘/.test(role)) income = 0.06;

    // 铺子在自家名下的，多分一点（东家分红）
    const mine = (world.assets?.properties || []).find((x) => x && x.owner === a.id);
    if (mine) income += Math.max(0, (Number(mine.incomePerDay) || 0) * 0.4);

    // ── 开销 ──
    let cost = 0.02;                          // 一人一日饭钱
    if (/天子|宰相|尚书|知府/.test(role)) cost = 0.15;
    else if (/知县|掌柜|东家|郎中/.test(role)) cost = 0.08;
    if (day % 30 === 0) cost += 0.1;          // 月租

    a.money = Math.round((a.money + income - cost) * 100) / 100;

    // 欠钱：记账 + 怨气
    if (a.money < 0) {
      a.money = 0;
      a.debt = Math.round(((Number(a.debt) || 0) + (cost - income)) * 100) / 100;
      const rel = a.relations?.husband;
      if (rel) rel.grievance = Math.min(100, Math.round((Number(rel.grievance) || 0) + 1));
      broke += 1;
      if (broke <= 2 && Math.random() < 0.02) {
        events.push(nextEvent(world, {
          action: 'poverty', actor: a.id, place: a.location,
          payload: { text: `${a.name}手头紧，欠了${a.debt}两` }, isPublic: true,
        }));
      }
    }
  }

  if (broke > 0 && day % 10 === 0) {
    console.log(`[Money] 第${day}日：${broke} 人手头见底`);
  }
}
"""
if 'runPersonalEconomy' not in c:
    anchor = "/** 每天：民间案子"
    idx = c.find(anchor)
    if idx < 0:
        idx = c.find("function runTreasury(")
    c = c[:idx] + fn + "\n" + c[idx:]
    print('③ 加入 runPersonalEconomy')

# 挂到每日 tick（放在国库之后）
if 'runPersonalEconomy(world, events);' not in c:
    c = c.replace("  runTreasury(world, events);", "  runTreasury(world, events);\n  runPersonalEconomy(world, events);", 1)
    print('④ 接入每日结算')

io.open(p2, 'w', encoding='utf-8').write(c)

# ============ ③ 接口：下发 money ============
p3 = 'src/server.js'
v = io.open(p3, encoding='utf-8-sig').read()
old = "            gender: a.gender || (key === 'husband' ? 'male' : '未知'),"
new = "            gender: a.gender || (key === 'husband' ? 'male' : '未知'),\n            money: typeof a.money === 'number' ? a.money : null,\n            debt: Number(a.debt) || 0,"
if old in v and 'money: typeof a.money' not in v:
    v = v.replace(old, new, 1)
    print('⑤ 接口下发 money/debt')
io.open(p3, 'w', encoding='utf-8').write(v)

print('done')
