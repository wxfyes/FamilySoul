import io
# ① 在岗判定改用产业名册（staffIds）为准，角色关键词只作兜底
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const onDuty = Object.values(world.actors || {}).filter((a) => {
    if (!a || a.dead) return false;
    const isAt = a.location === placeId || a.location === actualPlaceId || a.location === placeName || world.places"""
new = """  // 在岗：以产业名册为真相源；名册为空时才按身份关键词兜底
  const staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
  const onDuty = Object.values(world.actors || {}).filter((a) => {
    if (!a || a.dead) return false;
    const isAt = a.location === placeId || a.location === actualPlaceId || a.location === placeName || world.places"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 名册优先')

old2 = """    return a.id === prop.keeper || a.role?.includes('掌柜') || a.role?.includes('伙计') || a.role?.includes('跑堂') || a."""
new2 = """    if (staffIds.length) return staffIds.includes(a.id);
    return a.id === prop.keeper || a.role?.includes('掌柜') || a.role?.includes('伙计') || a.role?.includes('跑堂') || a."""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 名册非空时只认名册')
io.open(p, 'w', encoding='utf-8-sig').write(s)
