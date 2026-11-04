import io
# ① admin/world 的人物投影补上 home/marital/residence
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "            age: Number(a.age) || null,"
new = """            age: Number(a.age) || null,
            home: a.home || null,
            homeName: a.home ? (world.places?.[a.home]?.name || '') : '',
            marital: a.marital || null,
            residence: a.residence ? { type: a.residence.type, placeId: a.residence.placeId, placeName: world.places?.[a.residence.placeId]?.name || '' } : null,"""
if old in s and 'homeName:' not in s:
    s = s.replace(old, new, 1)
    print('① 人物投影补住处/婚配')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② 迁移：小院统一命名 + 指向正确
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """        a.residence = { type: 'own', placeId: houseId };
        if (!a.home || a.home === 'inn') a.home = houseId;
        console.log(`[Reg] ${a.name} 补上住处：${world.places[houseId].name}`);"""
new2 = """        a.residence = { type: 'own', placeId: houseId };
        if (!a.home || a.home === 'inn') a.home = houseId;
        console.log(`[Reg] ${a.name} 补上住处：${world.places[houseId].name}`);
      } else {
        // 已有住处：名字统一成"某某的小院"（老数据里可能叫"陆家小院"，同姓会撞）
        const pid = a.residence.placeId;
        const want = `${a.name}的小院`;
        if (world.places[pid] && world.places[pid].name !== want) {
          world.places[pid].name = want;
        }
        if (!a.home || a.home === 'inn') a.home = pid;"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 小院统一命名')
