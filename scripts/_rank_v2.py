import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("if (!world.flags?.rankNameFixV1) {", "if (!world.flags?.rankNameFixV2) {", 1)
s = s.replace("world.flags.rankNameFixV1 = { at: Date.now(), fixed };", "world.flags.rankNameFixV2 = { at: Date.now(), fixed };", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('改 V2')
