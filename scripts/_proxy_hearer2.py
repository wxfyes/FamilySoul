import io, re
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
pairs = [('husPost','mePost'), ('npc','mePost'), ('target','husN'), ('pickL','meL'), ('who','meM')]
n = 0
for actor_var, hearer_var in pairs:
    pat = re.compile(r'(\n(\s*)actor: ' + actor_var + r',\n)')
    m = pat.search(s)
    if m and f'hearer: {hearer_var}' not in s[max(0,m.start()-500):m.end()+500]:
        s = s[:m.end()] + f'{m.group(2)}hearer: {hearer_var},\n' + s[m.end():]
        n += 1
print('插入 hearer 数量:', n)
io.open(p, 'w', encoding='utf-8-sig').write(s)
