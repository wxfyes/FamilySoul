import io
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("name: `${rawName}的小院`,", "name: `${cityName || '临江府'}·${rawName}的小院`,", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('小院名字带上城')
