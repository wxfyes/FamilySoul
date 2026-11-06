import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function cityOfPlace' not in s:
    s += '''

/** 这处地方属于哪座城（按名字前缀认；老临江地点没有前缀，算临江府） */
export function cityOfPlace(world, placeId) {
  const name = String(world?.places?.[placeId]?.name || '');
  const cities = Object.keys(world?.cities || {}).sort((a, b) => b.length - a.length);
  for (const c of cities) {
    const base = c.replace(/府$|县$|州$/g, '');
    if (name.startsWith(`${c}·`) || name.startsWith(`${base}·`) || name.startsWith(c)) return c;
  }
  if (/临江/.test(name)) return '临江府';
  return '';
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('cityOfPlace 已加')
