import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    // tier≥2：儿女双全（公子与小姐各一），大户人家才有"少爷小姐"的层次
    if (tier >= 2) {
      members.push({ role: '公子', gender: 'male', age: 21, money: 30 });
      members.push({ role: '小姐', gender: 'female', age: 17, money: 20 });
    }"""
new = """    // tier≥2：儿女双全（补上与已有孩子不同的那一个）
    if (tier >= 2) {
      const hasSon = members.some((m) => m.role === '公子');
      const hasGirl = members.some((m) => m.role === '小姐');
      if (!hasSon) members.push({ role: '公子', gender: 'male', age: 21, money: 30 });
      if (!hasGirl) members.push({ role: '小姐', gender: 'female', age: 17, money: 20 });
    }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('避免重复儿女')
