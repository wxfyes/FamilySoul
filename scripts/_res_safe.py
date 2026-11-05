import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  for (const [pid, p] of Object.entries(world?.places || {})) {
    if (!p) continue;
    const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);"""
new = """  for (const [pid, p] of Object.entries(world?.places || {})) {
    try {
    if (!p) continue;
    const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);"""
if old in s:
    s = s.replace(old, new, 1)
    # 闭合每轮 try
    old2 = """    linkRooms(world, pid);
    assignStaffQuarters(world, pid);
  }
  return { homes, rooms, upgraded };"""
    new2 = """    linkRooms(world, pid);
    repairRooms(world, pid);
    assignStaffQuarters(world, pid);
    } catch (e) {
      console.warn(`[Residence] ${pid} 建院失败：${e.message}`);
    }
  }
  return { homes, rooms, upgraded };"""
    if old2 in s:
        s = s.replace(old2, new2, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('每座宅子独立兜错 + 修院')
