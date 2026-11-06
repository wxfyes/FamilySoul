import io
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("      place: `${rawName}的小院`,", "      place: world.places?.[houseId]?.name || `${cityName}·${rawName}的小院`,", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('返回落脚地名字修正')
