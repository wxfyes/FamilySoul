import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      // 在册人手：有 staffIds 就按实际在岗刷新人数
      const onDuty = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.location === prop.placeId);
      prop.staff = onDuty.length;"""
new = """      // 在册人手：只认同在岗的人，不在岗的从名册里剔掉
      const onDuty = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.location === prop.placeId);
      const dutyIds = new Set(onDuty.map((a) => a.id));
      if (Array.isArray(prop.staffIds)) prop.staffIds = prop.staffIds.filter((id) => dutyIds.has(id));
      prop.staff = onDuty.length;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('在册人手按实际在岗校正')
