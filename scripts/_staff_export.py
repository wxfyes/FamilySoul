import io
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "/** 这个势力每月该发多少饷（按兵种构成算） */"
fn = """/** 把招募来的人真的立进世界（家丁/护院），返回立了几人 */
export function spawnHouseholdStaff(world, count, kind = 'guard', homeId = 'husband_room') {
  const home = world.places?.[homeId];
  if (!home) return 0;
  const SURNAME = ['周', '吴', '郑', '王', '李', '陈', '张', '刘', '赵', '孙'];
  const GIVEN = ['阿福', '阿顺', '阿贵', '阿全', '阿安', '阿平', '阿庆', '阿寿', '阿泰', '阿和', '阿义', '阿勇'];
  const want = Math.max(0, Math.min(12, Number(count) || 0));
  let made = 0;
  for (let i = 0; i < want; i++) {
    const used = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
    let name = '';
    for (let t = 0; t < 30; t++) {
      const cand = SURNAME[Math.floor(Math.random() * SURNAME.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)];
      if (!used.has(cand)) { name = cand; break; }
    }
    if (!name) continue;
    const id = `staff_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`;
    world.actors[id] = {
      id, name,
      role: kind === 'guard' ? '家丁' : '护院',
      title: kind === 'guard' ? '家丁' : '护院',
      age: 20 + Math.floor(Math.random() * 15),
      home: homeId,
      quarters: home.rooms?.barracks?.id || home.rooms?.servant?.id || null,
      location: home.rooms?.barracks?.id || home.rooms?.gate?.id || homeId,
      servant: true,
      duty: { post: 'guard', home: homeId },
      relations: { husband: { trust: 45, desire: 0 } },
    };
    made += 1;
  }
  return made;
}

""" + anchor
if 'export function spawnHouseholdStaff' not in s:
    s = s.replace(anchor, fn, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加回导出')
