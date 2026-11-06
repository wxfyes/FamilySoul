import io
p = 'src/world/ritual.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const myPlace = world.actors?.[memberKey]?.location || world.actors?.husband?.location;"""
new = """  const myPlace = world.actors?.[memberKey]?.location || world.actors?.husband?.location;
  // 暗号只对"跟前的人"生效：人不在跟前，一律不结算
  if (world.actors?.[actorId]?.location !== myPlace) {
    console.warn(`[Ritual] ${world.actors?.[actorId]?.name || actorId} 不在跟前，暗号不作数`);
    return null;
  }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 暗号必须人在跟前')

# ② 伙伴解析也只看跟前
p2 = 'src/world/bedchamber.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """export function resolveBedPartner(world, actorId = 'husband', hint = '') {"""
new2 = """export function resolveBedPartner(world, actorId = 'husband', hint = '') {"""
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('② 留待核对')
