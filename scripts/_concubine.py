import io
# ① 通房/侍妾 也算妾室
p = 'src/world/persona.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("  if (/妾|二房|小妾|姨娘/.test(text)) return 'concubine';",
              "  if (/妾|二房|小妾|姨娘|通房|侍妾/.test(text)) return 'concubine';")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('① 通房算妾室')

# ② 迁移：府内通房补成妾室（不再"待字闺中"）
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
old = """      const isKin = a.household || a.spouse === 'husband';
      if (isKin) { a.marital = 'married'; fixed += 1; continue; }"""
new = """      const isKin = a.household || a.spouse === 'husband';
      const isConcubine = /通房|侍妾|妾|姨娘/.test(String(a.role || ''));
      if (isConcubine) { a.marital = 'concubine'; fixed += 1; continue; }
      if (isKin) { a.marital = 'married'; fixed += 1; continue; }"""
if old in t:
    t = t.replace(old, new, 1)
    print('② 通房补妾室')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
