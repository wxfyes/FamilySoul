import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
i = s.find("    // 【最高铁律】玩家自由：不替他决定、不逼他走线")
if i >= 0:
    j = s.find("\n", s.find("lines.push('【天条】", i)) + 1
    s = s[:i] + "    // （天条临时移除待验）\n" + s[j:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('临时移除天条')
