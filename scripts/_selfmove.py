import io
p = 'src/world/position.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  if (isHumanBound(world, actorId) && reason !== 'ui' && !/送客/.test(String(note || ''))) {"""
new = """  // 自己的打算、自己的走动、主人当面送客——都算"自己走"，真人绑定也放行
  const selfMove = /办自己的事|自己走动|送客|通禀允入/.test(String(note || ''));
  if (isHumanBound(world, actorId) && reason !== 'ui' && !selfMove) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 自己走放行真人绑定')
