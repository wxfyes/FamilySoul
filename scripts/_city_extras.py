import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function ensureCityExtras' not in s:
    s += '''

/** 老城补配套：差事表 + 乡绅/衙役（幂等） */
export function ensureCityExtras(world, cityName) {
  const city = String(cityName || '');
  const b = world?.flags?.cityBase?.[city];
  if (!b) return 0;
  __world = world;
  let n = 0;
  if (!Array.isArray(b.jobs)) {
    b.jobs = [
      { title: '米行帮工', pay: 0.05, place: b.streetId },
      { title: '客栈跑堂', pay: 0.05, place: b.innId },
      { title: '更夫', pay: 0.04, place: b.streetId },
      { title: '码头卸货', pay: 0.06, place: b.streetId },
    ];
    n += 1;
  }
  const slug = city.replace(/府$|县$|州$/g, '');
  for (const role of ['乡绅', '衙役']) {
    const nid = `${slug}_notable_${role}`;
    if (world.actors?.[nid]) continue;
    const nm = fallbackName(world, 'male');
    if (!nm) continue;
    const hid = `${slug}_house_${role}`;
    if (!world.places[hid]) {
      world.places[hid] = { id: hid, name: `${nm}宅`, exits: [b.streetId], residence: true, dynamic: true };
      ensureResidence(world, hid, { grade: role === '乡绅' ? 3 : 1 });
    }
    world.actors[nid] = {
      id: nid, name: nm, role, title: role, gender: 'male',
      age: 42 + Math.floor(Math.random() * 12), home: hid,
      location: role === '衙役' ? (b.yamenId || b.streetId) : b.marketId,
      money: role === '乡绅' ? 60 : 3, relations: {}, origin: 'city_base',
    };
    n += 1;
  }
  __world = null;
  return n;
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('extras 已加')

p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { ensureCityBase, ensureAllCityBases, streetOfCity } from './city.js';",
              "import { ensureCityBase, ensureAllCityBases, ensureCityExtras, streetOfCity } from './city.js';", 1)
old = """      const evicted = evictOutsiders(world);"""
new = """      // 老城补配套：差事表 + 乡绅/衙役
      try {
        for (const cn of Object.keys(world.flags?.cityBase || {})) ensureCityExtras(world, cn);
      } catch { /* 忽略 */ }
      const evicted = evictOutsiders(world);"""
if old in t and '老城补配套' not in t:
    t = t.replace(old, new, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('巡检补 extras')
