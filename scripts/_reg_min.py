import io
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 身份由年龄+性别推出来（不选、不设职业、不设剧本）
start = s.find('    // 身份与初入行当')
end = s.find("    const genderDesc = safeGender === 'female' ? '坤身女子' : '乾身男子';")
if start > 0 and end > 0:
    new = """    // 身份只由"性别 + 年龄"推出来：几岁就是几岁的人，职业与命数留给他自己走
    const ageWord = (() => {
      const a = numAge;
      if (a < 18) return safeGender === 'female' ? '少女' : '少年';
      if (a < 25) return safeGender === 'female' ? '青年女子' : '青年男子';
      if (a < 35) return safeGender === 'female' ? '妇人' : '男子';
      if (a < 50) return safeGender === 'female' ? '中年妇人' : '中年男子';
      return safeGender === 'female' ? '老妇' : '老者';
    })();
    const roleName = ageWord;
"""
    s = s[:start] + new + s[end:]
    print('① 身份由年龄+性别推出')

# ② 不再白送宅子：先落脚客栈，住哪靠自己
start2 = s.find('    // 一人一座小院')
end2 = s.find('    // 录入世界账本')
if start2 > 0 and end2 > 0:
    new2 = """    // 不白送宅子：先落脚客栈，住处与营生由他在世界里自己挣

"""
    s = s[:start2] + new2 + s[end2:]
    print('② 取消白送小院')

# ③ 起手二两，住客栈
s = s.replace("      home: houseId,\n      location: houseId,", "      home: null,\n      location: 'inn',", 1)
s = s.replace("      residence: { type: 'own', placeId: houseId },", "      residence: null,", 1)
s = s.replace("      money: 1.5, // 1.5两碎银起步盘缠（布衣起点，最多1.5两）",
              "      money: 2, // 二两碎银，够住几天客栈、吃几顿饭；再多就是替他写剧本了", 1)

# ④ 记叙改口
s = s.replace("落脚在自家小院。", "落脚在临江客栈。", 1)
s = s.replace("初涉江湖，落脚自家小院。", "初涉江湖，落脚临江客栈。", 1)
s = s.replace("），落脚自家小院，天道已建档", "），落脚临江客栈，天道已建档", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('③ 起手二两、落脚客栈')
