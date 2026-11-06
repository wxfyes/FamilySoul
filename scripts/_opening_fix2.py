import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("            const nearId = String(a.location || 'street');ation].residence ? a.location : 'street');",
              "            const nearId = String(a.location || 'street');", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('修掉残留尾巴')
