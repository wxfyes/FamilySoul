import io
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = """  fire(world, { action: 'recruit', actor: f.leader, place: town, payload: { text: `${f.name}在${town}一呼百应，来投 ${come} 人` } });"""
add = """
  // 招进来的人要落地成人：家丁/护院真的住进府里，不是账上一个数字
  try {
    if (f.id === 'wangjia' && (kind === 'guard' || kind === 'retainer')) {
      const homeId = 'husband_room';
      const home = world.places?.[homeId];
      if (home) {
        const SURNAME = ['周', '吴', '郑', '王', '李', '陈', '张', '刘', '赵', '孙'];
        const GIVEN = ['阿福', '阿顺', '阿贵', '阿全', '阿安', '阿平', '阿庆', '阿寿', '阿泰', '阿和'];
        let made = 0;
        for (let i = 0; i < Math.min(2, come); i++) {
          const used = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
          let name = '';
          for (let t = 0; t < 20; t++) {
            const cand = SURNAME[Math.floor(Math.random() * SURNAME.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)];
            if (!used.has(cand)) { name = cand; break; }
          }
          if (!name) continue;
          const id = `staff_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`;
          world.actors[id] = {
            id,
            name,
            role: kind === 'guard' ? '家丁' : '护院',
            age: 20 + Math.floor(Math.random() * 15),
            home: homeId,
            location: home.rooms?.gate?.id || homeId,
            quarters: null,
            servant: true,
            relations: { husband: { trust: 45, desire: 0 } },
          };
          made += 1;
        }
        if (made) {
          const { ensureGatekeeper } = await import('./posts.js');
          ensureGatekeeper(world, homeId);
          console.log(`[Staff] 新募 ${made} 人落籍入府`);
        }
      }
    }
  } catch (err) { console.log('[Staff] 落籍失败：', err.message); }

""" + anchor
if '招进来的人要落地成人' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 招募落籍 + 派门房')
