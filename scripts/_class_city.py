import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function ensureCityClasses' not in s:
    s += '''

/**
 * 城里的阶级：大户人家、富商、公子、小姐各有其人。
 * 只造"人与住处"，不预设他们的恩怨情仇。
 */
export function ensureCityClasses(world, cityName) {
  const city = String(cityName || '');
  const b = world?.flags?.cityBase?.[city];
  if (!b) return 0;
  if (b.classesDone) return 0;
  __world = world;
  const slug = city.replace(/府$|县$|州$/g, '');
  const tier = Number(b.tier) || 1;
  const day = num(world.clock?.day) || 1;
  let made = 0;

  const addFamily = (idx) => {
    const surname = ['沈', '顾', '陆', '谢', '崔', '裴', '柳', '薛', '温', '苏'][Math.floor(Math.random() * 10)];
    const given = (g) => {
      const male = ['文远', '景行', '子昂', '怀瑾', '承泽', '彦之'];
      const female = ['婉宁', '清欢', '知微', '若兰', '云舒', '含章'];
      const pool = g === 'female' ? female : male;
      return surname + pool[Math.floor(Math.random() * pool.length)];
    };
    const hid = `${slug}_estate_${idx}`;
    if (!world.places[hid]) {
      world.places[hid] = {
        id: hid, name: `${surname}府`, exits: [b.streetId], residence: true, dynamic: true, createdDay: day,
      };
      ensureResidence(world, hid, { grade: tier >= 3 ? 7 : 3 });
    }
    const members = [
      { role: '老爷', gender: 'male', age: 48, money: 400 + Math.random() * 600 },
      { role: '夫人', gender: 'female', age: 44, money: 120 },
      { role: idx % 2 === 0 ? '公子' : '小姐', gender: idx % 2 === 0 ? 'male' : 'female', age: 19 + Math.floor(Math.random() * 5), money: 30 },
    ];
    if (tier >= 3) members.push({ role: '小姐', gender: 'female', age: 17, money: 20 });
    for (const m of members) {
      const aid = `${slug}_gentry_${idx}_${m.role}`;
      if (world.actors[aid]) continue;
      world.actors[aid] = {
        id: aid, name: given(m.gender), role: m.role, title: m.role, gender: m.gender,
        age: m.age, home: hid, location: hid, money: Math.round(m.money * 100) / 100,
        household: true, relations: {}, origin: 'city_class', createdDay: day,
        spouse: null,
      };
      made += 1;
    }
    // 父母结成夫妻
    const lord = world.actors[`${slug}_gentry_${idx}_老爷`];
    const lady = world.actors[`${slug}_gentry_${idx}_夫人`];
    if (lord && lady) { lord.spouse = lady.id; lady.spouse = lord.id; lord.marital = 'married'; lady.marital = 'married'; }
    // 仆役两名
    for (let k = 0; k < 2; k += 1) {
      const sid = `${slug}_servant_${idx}_${k}`;
      if (world.actors[sid]) continue;
      const nm = fallbackName(world, k === 0 ? 'female' : 'male');
      if (!nm) continue;
      world.actors[sid] = {
        id: sid, name: nm, role: k === 0 ? '丫鬟' : '家丁', title: k === 0 ? '丫鬟' : '家丁',
        gender: k === 0 ? 'female' : 'male', age: 16 + k * 4,
        home: hid, location: hid, money: 0.4 + Math.random(), servant: true,
        relations: {}, origin: 'city_class', createdDay: day,
      };
      made += 1;
    }
  };

  const families = tier >= 3 ? 2 : 1;
  for (let i = 0; i < families; i += 1) addFamily(i + 1);

  // 富商（独立于大户）
  for (let i = 0; i < 1; i += 1) {
    const mid = `${slug}_tycoon_${i}`;
    if (!world.actors[mid]) {
      const nm = fallbackName(world, 'male');
      if (nm) {
        world.actors[mid] = {
          id: mid, name: nm, role: '富商', title: '富商', gender: 'male',
          age: 38 + Math.floor(Math.random() * 12), home: b.streetId, location: b.marketId,
          money: 300 + Math.random() * 500, relations: {}, origin: 'city_class', createdDay: day,
        };
        made += 1;
      }
    }
  }
  // 才女（书香门第，独立一位）
  const girlId = `${slug}_poetess`;
  if (!world.actors[girlId]) {
    const nm = fallbackName(world, 'female');
    if (nm) {
      world.actors[girlId] = {
        id: girlId, name: nm, role: '才女', title: '才女', gender: 'female',
        age: 18, home: b.streetId, location: b.streetId, money: 12,
        relations: {}, origin: 'city_class', createdDay: day,
      };
      made += 1;
    }
  }

  b.classesDone = { at: Date.now(), made };
  console.log(`[City] ${city} 阶级生成：大户 ${families} 户、富商 1、才女 1，共 ${made} 人`);
  __world = null;
  return made;
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加阶级生成器')

p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { ensureCityBase, ensureAllCityBases, ensureCityExtras, streetOfCity } from './city.js';",
              "import { ensureCityBase, ensureAllCityBases, ensureCityExtras, ensureCityClasses, streetOfCity } from './city.js';", 1)
old = """      try { dailyMarriages(world); } catch { /* 忽略 */ }"""
new = """      try { for (const cn of Object.keys(world.flags?.cityBase || {})) ensureCityClasses(world, cn); } catch { /* 忽略 */ }
      try { dailyMarriages(world); } catch { /* 忽略 */ }"""
if old in t:
    t = t.replace(old, new, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('巡检补阶级')
