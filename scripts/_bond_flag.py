import io
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("        world.bonds[aId][bId] = { type, score };\n        world.bonds[bId][aId] = { type, score };",
              "        world.bonds[aId][bId] = { type, score, manual: true };\n        world.bonds[bId][aId] = { type, score, manual: true };", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('patched')
