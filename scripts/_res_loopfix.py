import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """  for (const [pid, p] of Object.entries(world?.places || {})) {
    try {
    if (!p) continue;
    const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);"""
new = """  // 安全阀：地点已经多到不正常，就先不建了，免得把进程拖死
  if (Object.keys(world?.places || {}).length > 4000) {
    console.warn('[Residence] 地点过多，本轮跳过建院');
    return { homes: 0, rooms: 0, upgraded: 0 };
  }

  for (const [pid, p] of Object.entries(world?.places || {})) {
    try {
    if (!p) continue;
    // 院子本身不是宅子：有 parent 的都是某座宅子的房间，绝不再给它建院子
    if (p.parent) continue;
    if (String(pid).includes('__')) continue;
    const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 房间不再当宅子')
