import io

# ============ ① state.js：年龄/婚配改走单一推导 ============
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'persona.js' not in s:
    s = s.replace("import { ensureFactions } from './factions.js';",
                  "import { ensureFactions } from './factions.js';\n"
                  "import { inferAgeFromIdentity, inferMaritalStatus } from './persona.js';", 1)
    print('① state 引入 persona')

old = """      else if (/老鸨|鸨母/.test(role)) a.age = 38 + (id.length % 8);
      else if (/先生|老夫子|夫子/.test(role)) a.age = 58 + (id.length % 8);
      else if (/婆/.test(role)) a.age = 48 + (id.length % 10);
      else if (/寡妇|妇人/.test(role)) a.age = 28 + (id.length % 8);
      else if (/丫鬟|小厮|伙计/.test(role)) a.age = 16 + (id.length % 6);"""
new = """      // 年龄：姓名 + 身份一起看（王婆的 role 是"面摊"，只看 role 会把她判成少女）
      else if (/老鸨|鸨母/.test(role)) a.age = 38 + (id.length % 8);
      else if (/先生|老夫子|夫子/.test(role)) a.age = 58 + (id.length % 8);
      else a.age = inferAgeFromIdentity(a.name, role, a.gender, id);"""
if old in s:
    s = s.replace(old, new, 1)
    print('② 年龄改走单一推导')

# 迁移：所有成年缺婚配者补齐 marital（不再让前端兜底"未婚"）
anchor = "  // 岁时：长岁、及冠、衰朽（每 30 日一次）" if False else "  // 势力：朝廷、王家，以及将来天道推演出来的枭雄"
add = """  // 婚配：成年而缺字段的人，按世情补上（61 岁浆洗婆子不该是"待字闺中"）
  try {
    let fixed = 0;
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === 'husband') continue;
      if (a.marital) continue;
      if (!(Number(a.age) >= 18)) continue;
      const isKin = a.household || a.spouse === 'husband';
      if (isKin) { a.marital = 'married'; fixed += 1; continue; }
      a.marital = inferMaritalStatus(a.name, a.role, a.age, a.gender);
      fixed += 1;
    }
    if (fixed) console.log(`[Persona] 补全 ${fixed} 人的婚配状态`);
  } catch { /* 忽略 */ }

""" + anchor
if '补全 ${fixed} 人的婚配状态' not in s:
    s = s.replace(anchor, add, 1)
    print('③ 迁移补婚配')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② dispatch.js：天道衍生的人也走同一推导 ============
p2 = 'src/world/dispatch.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'persona.js' not in t:
    t = t.replace("import { moveActor } from './position.js';",
                  "import { moveActor } from './position.js';\nimport { inferAgeFromIdentity, inferMaritalStatus } from './persona.js';", 1)
    print('④ dispatch 引入 persona')
# spawn 时若没给年龄，按称谓推
old_spawn = "      relations: { husband: { trust: 40, desire: 0, fear: 0, grievance: 0 } },"
new_spawn = """      age: inferAgeFromIdentity(name, role, gender, name),
      marital: inferMaritalStatus(name, role, inferAgeFromIdentity(name, role, gender, name), gender),
      relations: { husband: { trust: 40, desire: 0, fear: 0, grievance: 0 } },"""
if old_spawn in t and 'inferAgeFromIdentity(name, role' not in t:
    t = t.replace(old_spawn, new_spawn, 1)
    print('⑤ 天道衍生的人按称谓定岁与婚配')
io.open(p2, 'w', encoding='utf-8-sig').write(t)

# ============ ③ clock.js：月事只算育龄（14~49），绝经清掉 ============
p3 = 'src/world/clock.js'
c = io.open(p3, encoding='utf-8-sig').read()
old_m = """  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.gender !== 'female' || !a.menses) continue;
    const m = a.menses;"""
new_m = """  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.gender !== 'female' || !a.menses) continue;
    const age = Number(a.age) || 0;
    // 绝经与幼女不参与月事；残留数据一并清掉
    if (age >= 50 || (age > 0 && age < 14)) {
      delete a.menses;
      a.onPeriod = false;
      continue;
    }
    const m = a.menses;"""
if old_m in c:
    c = c.replace(old_m, new_m, 1)
    print('⑥ 月事只算育龄')
io.open(p3, 'w', encoding='utf-8-sig').write(c)
