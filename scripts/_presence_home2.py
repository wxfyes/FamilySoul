import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          const pname = String(wR0.places?.[a.location]?.name || '');
          if (!pname.startsWith(estate)) continue;"""
new = """          const pname = String(wR0.places?.[a.location]?.name || '');
          const homeName = String(wR0.places?.[a.home]?.name || '');
          // 本宅的内眷（哪怕被旧目标支到街上）都该在府里，先请回这间
          const belongsEstate = homeName.startsWith(estate);
          if (!pname.startsWith(estate) && !belongsEstate) continue;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('请回本宅内眷')
