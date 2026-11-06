import io
p = 'src/world/privacy.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """export function belongsTo(world, actor, home) {
  if (!actor || !home) return false;
  if (String(actor.home || '') === String(home.id)) return true;"""
new = """export function belongsTo(world, actor, home) {
  if (!actor || !home) return false;
  // 宅子的主人当然是本家（否则自己的正房反而进不去）
  if (home.owner && String(home.owner) === String(actor.id)) return true;
  if (String(actor.home || '') === String(home.id)) return true;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 主人算本家')
