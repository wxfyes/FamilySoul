import io
p = 'src/world/marriage.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const girls = Object.values(world?.actors || {}).filter((a) => a && !a.dead
    && /小姐|才女/.test(String(a.role || '')) && isMarriageable(world, a)
    && cityOf(world, a) === city);"""
new = """  // 只挑"有府邸、有老爷做主"的人家，别把街上独居的才女当成大户提亲
  const girls = Object.values(world?.actors || {}).filter((a) => a && !a.dead
    && /小姐|才女/.test(String(a.role || '')) && isMarriageable(world, a)
    && cityOf(world, a) === city)
    .filter((a) => {
      const h = world.places?.[a.home];
      if (!h?.residence) return false;
      return Object.values(world.actors || {}).some((x) => x && x.role === '老爷' && x.home === a.home);
    });"""
if old in s:
    s = s.replace(old, new, 1)
    # familyName/lord 取同宅老爷
    s = s.replace("""  const family = girl.home && world.places?.[girl.home];
  const lord = Object.values(world.actors || {}).find((a) => a && a.home === girl.home && a.role === '老爷');""",
"""  const family = girl.home && world.places?.[girl.home];
  const lord = Object.values(world.actors || {}).find((a) => a && a.home === girl.home && a.role === '老爷');""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('只挑有府邸的小姐')
