import io

# ① 自愈：性别 unknown/缺失 一律按名字与身份补
p = 'src/world/heal.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'inferGenderFromIdentity' not in s:
    s = s.replace("import { inferAgeFromIdentity, inferMaritalStatus } from './persona.js';",
                  "import { inferAgeFromIdentity, inferMaritalStatus, inferGenderFromIdentity } from './persona.js';")
    old = """      const text = `${a.name || ''} ${a.role || ''}`;"""
    new = """      // 性别不许留 unknown：看不出女子特征就当男子
      if (!a.gender || a.gender === 'unknown') {
        a.gender = inferGenderFromIdentity(a.name, a.role, 'male');
        fixes.push(`${a.name}性别校正为${a.gender === 'male' ? '男' : '女'}`);
      }
      const text = `${a.name || ''} ${a.role || ''}`;"""
    if old in s:
        s = s.replace(old, new, 1)
        print('① heal 补性别')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② 迁移：性别未知者补齐 + 按新规则重算未婚/已婚
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'inferGenderFromIdentity' not in t:
    t = t.replace("import { inferAgeFromIdentity, inferMaritalStatus } from './persona.js';",
                  "import { inferAgeFromIdentity, inferMaritalStatus, inferGenderFromIdentity } from './persona.js';")
    anchor = "  // 婚配：成年而缺字段的人，按世情补上"
    add = """  // 性别：天道衍生的人可能是 unknown，一律按名字与身份补
  try {
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead) continue;
      if (!a.gender || a.gender === 'unknown') {
        a.gender = inferGenderFromIdentity(a.name, a.role, 'male');
      }
    }
  } catch { /* 忽略 */ }

""" + anchor
    if anchor in t:
        t = t.replace(anchor, add, 1)
        print('② 迁移补性别')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
