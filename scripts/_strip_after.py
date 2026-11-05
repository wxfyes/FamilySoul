import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    const now = Date.now();\n    let audioKey = null;"
add = """    // 身份前缀补完之后，再按在场铁律收一遍（防止后段把不在场的人加回来）
    try {
      const cleaned2 = this._stripIllegalSpeakers(reply);
      if (cleaned2) reply = cleaned2;
    } catch { /* 忽略 */ }

""" + anchor
if '身份前缀补完之后' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 前缀后再收一遍')
