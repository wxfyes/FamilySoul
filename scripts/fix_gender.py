import io

# ---------- ① husband 补 gender ----------
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """        id: 'husband',
        name: '王甯',
        role: '相公',
        playerControlled: true,"""
new = """        id: 'husband',
        name: '王甯',
        role: '相公',
        gender: 'male',
        playerControlled: true,"""
if old in s:
    s = s.replace(old, new, 1)
    print('① husband 补上 gender: male')
else:
    print('WARN: husband 定义没找到')

# ---------- ② 迁移：按身份修正性别（郎中/掌柜/镖头 一律男） ----------
mig = """export function migrateOwnership(world) {
  // 按身份修正性别：早年生成的郎中/掌柜/镖头被误标成女
  try {
    const MALE_ROLE = /郎中|大夫|掌柜|东家|镖头|镖师|先生|夫子|僧人|道士|捕头|仵作|书办|衙役|工头|船夫|艄公|小二|伙计|小厮|教书/;
    const FEMALE_ROLE = /婆|娘|嫂|姑|妇|女|氏|姐|妹|丫鬟|丫头|嬷嬷|稳婆|媒婆|绣娘/;
    let fixed = 0;
    for (const a of Object.values(world.actors || {})) {
      if (!a || !a.role) continue;
      const role = String(a.role);
      if (a.id === 'husband') { a.gender = 'male'; continue; }
      if (MALE_ROLE.test(role) && !FEMALE_ROLE.test(role)) {
        if (a.gender !== 'male') { a.gender = 'male'; fixed += 1; }
      }
    }
    if (fixed) console.log(`[State] 性别修正：${fixed} 位（郎中等误标为女）`);
  } catch { /* 忽略 */ }"""
anchor = "export function migrateOwnership(world) {"
if anchor in s and '性别修正' not in s:
    s = s.replace(anchor, mig, 1)
    print('② 加入性别迁移')

io.open(p, 'w', encoding='utf-8').write(s)

# ---------- ③ spawn：性别按身份推断，不再一律 female ----------
p2 = 'src/world/dispatch.js'
d = io.open(p2, encoding='utf-8-sig').read()
old2 = "        gender: String(args.gender || 'female'),"
new2 = """        gender: String(args.gender || (() => {
          const r = String(args.role || '');
          if (/郎中|大夫|掌柜|东家|镖头|镖师|先生|夫子|僧|道|捕头|仵作|书办|衙役|工头|船夫|艄公|小二|伙计|小厮|侍卫|门房|账房/.test(r)) return 'male';
          if (/婆|娘|嫂|姑|妇|女|姐|妹|丫鬟|丫头|嬷嬷|稳婆|媒婆|绣娘|花魁/.test(r)) return 'female';
          return Math.random() < 0.5 ? 'male' : 'female';
        })()),"""
if old2 in d:
    d = d.replace(old2, new2, 1)
    print('③ 造人性别按身份推断')
else:
    print('WARN: spawn gender 没找到')

io.open(p2, 'w', encoding='utf-8').write(d)

# ---------- ④ 服务端默认值：别再把男的当女的 ----------
p3 = 'src/server.js'
e = io.open(p3, encoding='utf-8-sig').read()
old3 = "            gender: a.gender || 'female',"
new3 = "            gender: a.gender || (key === 'husband' ? 'male' : '未知'),"
if old3 in e:
    e = e.replace(old3, new3, 1)
    print('④ 服务端性别默认值修正')
io.open(p3, 'w', encoding='utf-8').write(e)

print('done')
