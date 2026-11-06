import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function ensureShopStaff' not in s:
    s += '''

/**
 * 铺面配人：一间铺子开门，就得有人当值。
 *   客栈：掌柜 + 跑堂（大城再加小二）
 *   米行：掌柜 + 伙计
 *   药铺：掌柜（大城加伙计）
 *   茶摊：摊主
 * 小铺老板即掌柜，大铺东家雇掌柜——这是行当规矩，不是临时安排。
 */
export function ensureShopStaff(world, cityName) {
  const city = String(cityName || '');
  const b = world?.flags?.cityBase?.[city];
  if (!b) return 0;
  const slug = city.replace(/府$|县$|州$/g, '');
  const tier = Number(b.tier) || 1;
  const day = num(world.clock?.day) || 1;
  let made = 0;

  const spawn = (placeId, role, idx) => {
    if (!placeId || !world.places?.[placeId]) return;
    const id = `${slug}_shop_${placeId}_${idx}`;
    if (world.actors?.[id]) return;
    // 一间铺子只要一个掌柜，别重复
    if (role === '掌柜' && Object.values(world.actors || {}).some((a) => a && !a.dead && a.location === placeId && /掌柜/.test(String(a.role || '')))) return;
    const nm = fallbackName(world, role === '帮佣' ? 'female' : 'male');
    if (!nm) return;
    world.actors[id] = {
      id, name: nm, role, title: role, gender: role === '帮佣' ? 'female' : 'male',
      age: 24 + (idx * 7) % 20, home: placeId, location: placeId,
      money: 2 + Math.random() * 4, relations: {}, origin: 'shop_staff', createdDay: day,
    };
    made += 1;
  };

  // 客栈
  spawn(b.innId, '掌柜', 1);
  spawn(b.innId, '跑堂', 2);
  if (tier >= 2) spawn(b.innId, '小二', 3);
  // 米行
  spawn(b.riceId, '掌柜', 1);
  spawn(b.riceId, '伙计', 2);
  // 药铺（大城才有）
  if (b.herbId) spawn(b.herbId, '掌柜', 1);
  if (b.herbId && tier >= 3) spawn(b.herbId, '伙计', 2);
  // 茶摊
  if (b.teaId) spawn(b.teaId, '摊主', 1);

  console.log(`[Shop] ${city} 铺面配人 ${made} 名`);
  return made;
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('ensureShopStaff 已加')
