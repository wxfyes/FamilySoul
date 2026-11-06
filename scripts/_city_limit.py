import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 临江不另造街：用原来的 street
old = """  const streetId = `${slug}_street`;"""
new = """  // 临江府的老地方就是 street，别再造一条"临江府·主街"
  const streetId = city === '临江府' && world.places?.street ? 'street' : `${slug}_street`;"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 临江复用 street')

# ② 只铺"大城"：按富庶度取前 12 + 临江
old2 = """export function ensureAllCityBases(world) {
  let n = 0;
  for (const city of Object.keys(world.cities || {})) {"""
new2 = """export function ensureAllCityBases(world) {
  let n = 0;
  const cities = Object.entries(world.cities || {})
    .sort((a, b) => (Number(b[1]?.wealth) || 0) - (Number(a[1]?.wealth) || 0))
    .map(([k]) => k);
  const keep = new Set(['临江府', ...cities.slice(0, 12)]);
  for (const city of Object.keys(world.cities || {})) {
    if (!keep.has(city)) continue;"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 只铺大城')
io.open(p, 'w', encoding='utf-8-sig').write(s)
