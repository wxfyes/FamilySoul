import io
p = 'src/world/marriage.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """const cityOf = (world, actor) => labelOf(world.places?.[actor?.location]?.name, world);"""
new = """const cityOf = (world, actor) => {
  const byName = labelOf(world.places?.[actor?.location]?.name, world);
  if (byName !== '临江府') return byName;
  // 老宅名没带城（如"裴府"）：按 home 的 id 前缀认城
  const hid = String(actor?.home || '');
  for (const c of Object.keys(world?.cities || {})) {
    const slug = c.replace(/府$|县$|州$/g, '');
    if (hid.startsWith(`${slug}_`)) return c;
  }
  return byName;
};"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① cityOf 认 id 前缀')

p2 = 'src/world/city.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("id: hid, name: `${surname}府`,", "id: hid, name: `${city}·${surname}府`,", 1)
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('② 府名带城')
