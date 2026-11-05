import io
p = 'src/world/member-card.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """function husbandLine(world, actorId) {
  const hus = Object.values(world.actors || {}).find((a) => a && a.id === 'husband');
  if (!hus) return null;
  if (hus.location === world.actors?.[actorId]?.location) {
    return `【王甯】你的相好，临江茶坊东家，此刻就在你跟前（他本人不在线，由你代演他）。`;
  }
  const place = getPlaceDisplayName(world, hus.location);
  return `【王甯】你的相好，临江茶坊东家，此刻在「${place}」，不在这儿（他本人不在线，通篇由你代演他）。`;
}"""
new = """function husbandLine(world, actorId) {
  const hus = world.actors?.husband;
  if (!hus) return null;
  const me = world.actors?.[actorId];
  // 只有他的妻妾、府内人、亲生子女，才与王甯有婚配/亲缘关系
  const isKin = Boolean(me && (me.household || me.spouse === 'husband' || (Array.isArray(me.parents) && me.parents.includes('husband'))));
  const where = hus.location === me?.location
    ? '此刻就在你跟前'
    : `此刻在「${getPlaceDisplayName(world, hus.location)}」，不在这儿`;
  if (isKin) {
    return `【王甯】你的丈夫（临江茶坊东家），${where}（他本人不在线，由你代演他）。`;
  }
  return `【王甯】临江茶坊东家王掌柜，与你并无婚配、也无亲缘，只是个城里的东家；${where}（他本人不在线，由你代演他）。绝不许把他说成你的相公，也不许自称王家人。`;
}"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('身份卡：王甯不再默认是她的相好')
