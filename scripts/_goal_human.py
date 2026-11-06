import io
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    if (String(a.id).startsWith('usr_')) continue;      // 真人的事由玩家自己定"
new = "    if (String(a.id).startsWith('usr_') || a.id === 'husband' || a.humanBound) continue;   // 真人的事由玩家自己定"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 目标不给真人')

p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """      delete world.flags.lastTick;
      const tick = advanceWorldTick(world, Number(world.clock?.hour) || 0);"""
new2 = """      delete world.flags.lastTick;
      if (body && body.regen) { world.flags.goalDay = 0; for (const a of Object.values(world.actors || {})) if (a) delete a.goal; }
      const tick = advanceWorldTick(world, Number(world.clock?.hour) || 0);"""
if old2 in t and 'body.regen' not in t:
    t = t.replace(old2, new2, 1)
    # tick-run 里要有 body 变量
    t = t.replace("""  if (req.method === 'POST' && pathname === '/api/admin/tick-run') {
    try {
      const member = resolveMember(req, url);""",
"""  if (req.method === 'POST' && pathname === '/api/admin/tick-run') {
    try {
      const body = await parseJsonBody(req, 8 * 1024);
      const member = resolveMember(req, url);""", 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② tick-run 支持重生成目标')
