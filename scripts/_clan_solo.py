import io
p = 'src/world/clans.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (ids.length < 2) continue;"""
new = """    // 有两人才算一族；只有一人、但此人是王家亲眷（妻妾/血亲），也算他娘家那一族
    if (ids.length < 2) {
      const solo = world.actors?.[ids[0]];
      const kin = solo && (solo.household || solo.spouse === 'husband' || solo.relations?.husband);
      if (!kin) continue;
    }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('宗族成立条件：亲眷独苗也算娘家一族')
