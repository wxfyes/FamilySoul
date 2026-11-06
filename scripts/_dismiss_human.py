import io
p = 'src/world/position.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  if (isHumanBound(world, actorId) && reason !== 'ui') {
    return { ok: false, error: '真人角色不接受世界移动' };
  }"""
new = """  // 真人角色不能被别人随意搬；但主人当面送客（note 带"送客"）是明确的离场指令
  if (isHumanBound(world, actorId) && reason !== 'ui' && !/送客/.test(String(note || ''))) {
    return { ok: false, error: '真人角色不接受世界移动' };
  }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 送客可移真人绑定角色')
