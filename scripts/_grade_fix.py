import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """export function residenceGrade(name = '', scale = 0) {
  const s = String(name || '');
  if (/府$|侯|伯|公府/.test(s)) return 7;"""
new = """export function residenceGrade(name = '', scale = 0) {
  const s = String(name || '');
  // 契纸上写明的规模优先（"七进大宅"就是七进）
  if (scale >= 7) return 7;
  if (scale >= 5) return 5;
  if (scale >= 3) return 3;
  if (/府$|侯|伯|公府/.test(s)) return 7;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('规模优先于名字')
