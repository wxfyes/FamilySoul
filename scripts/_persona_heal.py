import io
# ① heal：存量人物岁数/婚配/月事自愈
p = 'src/world/heal.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'inferAgeFromIdentity' not in s:
    first = s.find('\n', s.find('import ')) if s.find('import ') >= 0 else -1
    if first > 0:
        s = s[:first+1] + "import { inferAgeFromIdentity, inferMaritalStatus } from './persona.js';\n" + s[first+1:]
    else:
        s = "import { inferAgeFromIdentity, inferMaritalStatus } from './persona.js';\n" + s
    print('① heal 引入 persona')

anchor = "  return fixes;"
block = """  // ⑭ 世情自愈：姓名带"婆/嬷/老/翁"却是少年岁数的，按称谓改正；绝经者清月事
  try {
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead) continue;
      const text = `${a.name || ''} ${a.role || ''}`;
      const looksOld = /婆|嬷嬷|老太|妪|翁|老汉|老者/.test(text);
      if (looksOld && Number(a.age) < 45) {
        const before = Number(a.age) || 0;
        a.age = inferAgeFromIdentity(a.name, a.role, a.gender, a.id);
        fixes.push(`${a.name}（原${before}岁）校正为${a.age}岁`);
        if (a.age >= 50) { delete a.menses; a.onPeriod = false; }
      }
      if (!a.marital && Number(a.age) >= 18 && a.id !== 'husband') {
        a.marital = a.household ? 'married' : inferMaritalStatus(a.name, a.role, a.age, a.gender);
      }
      if (Number(a.age) >= 50 && a.menses) {
        delete a.menses;
        a.onPeriod = false;
        fixes.push(`${a.name}绝经，清掉月事`);
      }
    }
  } catch { /* 忽略 */ }

""" + anchor
if '世情自愈' not in s:
    s = s.replace(anchor, block, 1)
    print('② heal 加世情自愈')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② server 负载：婚配与身子直接给中文，前端不再兜底
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'persona.js' not in t:
    t = t.replace("import { marketSnapshot } from './world/prices.js';",
                  "import { marketSnapshot } from './world/prices.js';\nimport { maritalTextOf, mensesStatusText } from './world/persona.js';")
    print('③ server 引入 persona')

old = "            marital: a.marital || null,"
new = "            marital: a.marital || null,\n            maritalText: maritalTextOf(a, a.spouse ? (world.actors?.[a.spouse]?.name || '') : ''),\n            bodyText: mensesStatusText(a),"
if old in t and 'maritalText:' not in t:
    t = t.replace(old, new, 1)
    print('④ 负载给婚配与身子中文')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
