import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (tier >= 3) members.push({ role: '小姐', gender: 'female', age: 17, money: 20 });"""
new = """    // tier≥2：儿女双全（公子与小姐各一），大户人家才有"少爷小姐"的层次
    if (tier >= 2) {
      members.push({ role: '公子', gender: 'male', age: 21, money: 30 });
      members.push({ role: '小姐', gender: 'female', age: 17, money: 20 });
    }"""
if old in s:
    s = s.replace(old, new, 1)
    # 避免重复键：把第三个成员的键加上序号
    s = s.replace("      const aid = `${slug}_gentry_${idx}_${m.role}`;",
                  "      const aid = `${slug}_gentry_${idx}_${m.role}_${m.age}`;", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('每户补儿女双全')
