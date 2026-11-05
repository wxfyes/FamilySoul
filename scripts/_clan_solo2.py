import io
p = 'src/world/clans.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "      const kin = solo && (solo.household || solo.spouse === 'husband' || solo.relations?.husband);"
new = "      const kin = solo && (solo.id === 'husband' || solo.household || solo.spouse === 'husband' || solo.relations?.husband);"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('王氏本宗也建族')
