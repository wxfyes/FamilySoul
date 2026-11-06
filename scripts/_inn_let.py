import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("  const innId = `${slug}_inn`;", "  let innId = `${slug}_inn`;", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('const→let')
