import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      if (a.marital) continue;"""
new = """      // 通房/侍妾/姨娘：名分以身份为准，哪怕先前被误写成 single/married
      if (/通房|侍妾|小妾|姨娘/.test(String(a.role || ''))) {
        if (a.marital !== 'concubine') { a.marital = 'concubine'; fixed += 1; }
        continue;
      }
      if (a.marital) continue;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('迁移强制纠正妾室名分')
