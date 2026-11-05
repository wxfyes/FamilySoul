import io

# ============ ① 一次性重判 v3：年轻未婚池要够 ============
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "  // 一次性：按新世情重算非亲眷的婚配（旧规则把 24 岁以上全判已婚，导致\"全城皆已婚\"）"
add = """  // 一次性重判 v3：把"被旧规则判成已婚"的年轻人放回未婚池
  // 判法按名字定（不随机），同一人每次读档结果一致
  try {
    world.flags = world.flags || {};
    if (!world.flags.maritalRecheckV3) {
      let freed = 0;
      const hashOf = (n) => {
        let h = 0;
        for (const ch of String(n || '')) h = (h * 131 + ch.codePointAt(0)) % 1000;
        return h;
      };
      const singleChance = (age, gender) => {
        const a = Number(age) || 20;
        if (gender === 'male') {
          if (a <= 22) return 0.7;
          if (a <= 26) return 0.45;
          return 0.2;
        }
        if (a <= 19) return 0.85;
        if (a <= 23) return 0.75;
        if (a <= 27) return 0.55;
        if (a <= 29) return 0.35;
        return 0;
      };
      for (const a of Object.values(world.actors || {})) {
        if (!a || a.dead || a.id === 'husband') continue;
        if (a.household || a.spouse) continue;                 // 有主的（内眷/有配偶）不动
        if (a.pregnancy && !a.pregnancy.born) continue;        // 有孕的不动
        if (/通房|侍妾|小妾|姨娘/.test(String(a.role || ''))) continue;
        const age = Number(a.age) || 0;
        if (age < 16 || age > 29) continue;
        if (a.marital !== 'married') continue;                 // 只放开"被判已婚"的年轻人
        const chance = singleChance(age, a.gender);
        if ((hashOf(a.name) % 100) < chance * 100) {
          a.marital = 'single';
          freed += 1;
        }
      }
      world.flags.maritalRecheckV3 = { day: world.clock?.day || 1, freed };
      if (freed) console.log(`[Persona] 年轻未婚池放开 ${freed} 人`);
    }
  } catch { /* 忽略 */ }

""" + anchor
if 'maritalRecheckV3' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 一次性重判 v3')

# ============ ② 人口补充：按"未婚女子池"补，且补得更多 ============
p2 = 'src/world/demography.js'
t = io.open(p2, encoding='utf-8-sig').read()
old = """  const pool = Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.age >= 16 && a.age <= 30 && (!a.marital || a.marital === 'single'),
  );
  if (pool.length >= 12) return [];

  const want = Math.min(3, 12 - pool.length);"""
new = """  // 只看"未婚女子池"：市井里该有可遇见的姑娘，而不是全城人妇
  const pool = Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.gender === 'female' && a.age >= 16 && a.age <= 28 && (!a.marital || a.marital === 'single'),
  );
  if (pool.length >= 18) return [];

  const want = Math.min(5, 18 - pool.length);"""
if old in t:
    t = t.replace(old, new, 1)
    # 女性比例提高
    t = t.replace("const female = Math.random() < 0.6;", "const female = Math.random() < 0.75;")
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 未婚女子池补人（每月最多 5 人）')
