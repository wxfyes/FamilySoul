import io
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()
for line in ["    医馆: ['药铺', '药堂', '回春堂', '医'],\n", "    药房: ['回春堂', '药铺'],\n"]:
    s = s.replace(line, '')
io.open(p, 'w', encoding='utf-8').write(s)
print('removed 医馆/药房 synonyms (allow creation)')
