import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          sweepDay: world.flags?.residenceSweptDay || null,
          sweepVer: world.flags?.residenceBuildVersion || null,"""
new = """          sweepDay: world.flags?.residenceSweptDay || null,
          sweepVer: world.flags?.residenceBuildVersion || null,
          // 生成立体空间体检
          roomPlaces: Object.keys(world.places || {}).filter((k) => world.places[k]?.parent).length,
          wangRooms: Object.values(root.rooms || {}).map((r) => `${r.name}:${r.depth || '-'}/${r.access || '-'}`),
          restaurant: Object.values(world.places?.canal_restaurant?.rooms || {}).map((r) => r.name),
          yamen: Object.values(world.places?.yamen?.rooms || {}).map((r) => r.name),
          itinerantInHome: Object.values(world.actors || {})
            .filter((a) => a && !a.dead && /卖花|货郎|挑夫|轿夫|游商/.test(String(a.role || '')) && world.places?.[a.home]?.residence && world.places[a.home]?.owner !== a.id)
            .map((a) => a.name),"""
if old in s:
    s = s.replace(old, new, 1)
    # 去重：原来已有 roomPlaces 字段（旧诊断），删掉旧的
    s = s.replace("          roomPlaces: Object.values(root.rooms || {}).map((r) => ({ id: r.id, exists: Boolean(world.places?.[r.id]), name: world.places?.[r.id]?.name })),\n", "")
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('诊断口扩到立体空间')
