import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  world.flags.cityBase[city] = { at: Date.now(), streetId, marketId, innId, tier, people };"""
new = """  // ── 大户与官府：一城至少一个乡绅、一个衙役，外城才有"能主事的人" ──
  const notables = [
    { role: '乡绅', place: marketId, money: 60 },
    { role: '衙役', place: yamenId, money: 3 },
  ];
  for (const n of notables) {
    const nm = fallbackName(world, 'male');
    if (!nm) continue;
    const nid = `${slug}_notable_${n.role}`;
    if (world.actors[nid]) continue;
    const hid = `${slug}_house_${n.role}`;
    if (!world.places[hid]) {
      world.places[hid] = { id: hid, name: `${nm}宅`, exits: [streetId], residence: true, dynamic: true, createdDay: num(world.clock?.day) || 1 };
      ensureResidence(world, hid, { grade: n.role === '乡绅' ? 3 : 1 });
    }
    world.actors[nid] = {
      id: nid, name: nm, role: n.role, title: n.role, gender: 'male',
      age: 40 + Math.floor(Math.random() * 15),
      home: hid, location: n.place, money: n.money, relations: {},
      origin: 'city_base', createdDay: num(world.clock?.day) || 1,
    };
    people += 1;
  }

  // ── 本地差事：给外城一个能挣饭吃的入口 ──
  const jobs = [
    { title: '米行帮工', pay: 0.05, place: riceId },
    { title: '客栈跑堂', pay: 0.05, place: innId },
    { title: '更夫', pay: 0.04, place: streetId },
    { title: '码头卸货', pay: 0.06, place: streetId },
  ];

  world.flags.cityBase[city] = { at: Date.now(), streetId, marketId, innId, tier, people, jobs };"""
if old in s and '本地差事' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('城市加大户/衙役/差事')
