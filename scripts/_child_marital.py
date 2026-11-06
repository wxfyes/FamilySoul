import io
p = 'src/world/heal.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      if (!a.marital && Number(a.age) >= 18 && a.id !== 'husband') {
        a.marital = a.household ? 'married' : inferMaritalStatus(a.name, a.role, a.age, a.gender);
      }"""
new = """      // 少爷小姐才女：没成亲就是未婚，不能因为"住在府里"就算已婚
      const isChild = /小姐|公子|才女|少爷|姑娘/.test(String(a.role || ''));
      if (isChild && a.marital === 'married' && !a.spouse) {
        a.marital = 'single';
        fixes.push(`${a.name}名分校正为未婚`);
      }
      if (!a.marital && Number(a.age) >= 18 && a.id !== 'husband') {
        a.marital = isChild ? 'single' : (a.spouse ? 'married' : (a.household ? 'married' : inferMaritalStatus(a.name, a.role, a.age, a.gender)));
      }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('修名分')

p2 = 'src/world/persona.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """  if (spouseName) return `已婚 · ${spouseName}`;"""
new2 = """  if (spouseName) return `已婚 · ${spouseName}`;
  if (/小姐|公子|才女|少爷|姑娘/.test(String(a.role || '')) && !a.spouse) {
    return a.gender === 'male' ? '未婚 · 尚未娶亲' : '未婚 · 待字闺中';
  }"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('措辞校正')
