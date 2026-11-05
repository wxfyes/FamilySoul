import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const myCity = Object.values(wB.cities || {}).find((ct) => ct && ct.name && myPlaceName(wB, meB?.location));
      const hereRegion = String(wB.places?.[meB?.location]?.name || '').split('·')[0] || '';
"""
if old in s:
    s = s.replace(old, "", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('删掉未定义变量（myPlaceName/myCity）')
