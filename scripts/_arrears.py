import io
p='src/world/clock.js'
s=io.open(p,encoding='utf-8-sig').read()
old="  // 秋收入仓（每 30 天一次），灾荒出仓"
new="""  // 欠俸：国库长期不足，官府只能加派、贪腐更狠
  if (tr.silver < 300) {
    world.flags = world.flags || {};
    world.flags.courtPressure = Math.min(100, (Number(world.flags.courtPressure) || 0) + 2);
    if (day % 7 === 0) {
      events.push(nextEvent(world, { action: 'arrears', actor: 'court', place: null, payload: { text: '官俸拖欠，衙门加派捐税' }, isPublic: true }));
    }
  }

  // 秋收入仓（每 30 天一次），灾荒出仓"""
assert old in s
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('added arrears pressure')
