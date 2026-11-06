import io
p = 'src/world/chat-actions.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const names = [];
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === me.id) continue;
      if (!isOuterStaff(a)) continue;
      const pn = String(world.places?.[a.location]?.name || '');
      const hn = String(world.places?.[a.home]?.name || '');
      if (!(pn.startsWith(estate) || hn.startsWith(estate))) continue;
      if (a.location === hall) { names.push(`${a.name}（厅上）`); continue; }
      const mv = hall ? moveActor(world, a.id, hall, 'world', '厅上候令') : { ok: false };
      if (mv?.ok) names.push(`${a.name}（厅上）`);
    }"""
new = """    // 只提当值的这一班：最多 8 人，其余照旧守各处
    const candidates = Object.values(world.actors || {}).filter((a) => {
      if (!a || a.dead || a.id === me.id) return false;
      if (!isOuterStaff(a)) return false;
      if (a.location === hall) return false;
      const pn = String(world.places?.[a.location]?.name || '');
      const hn = String(world.places?.[a.home]?.name || '');
      return pn.startsWith(estate) || hn.startsWith(estate);
    }).slice(0, 8);
    const names = [];
    for (const a of candidates) {
      const mv = hall ? moveActor(world, a.id, hall, 'world', '厅上候令') : { ok: false };
      if (mv?.ok) names.push(a.name);
    }"""
if old in s:
    s = s.replace(old, new, 1)
    s = s.replace("""    notices.push(names.length
      ? (names.length > 6 ? `${names.slice(0, 6).join('、')}等 ${names.length} 人到了议事厅候令。` : `${names.join('、')}到了议事厅候令。`)
      : '（宅里此刻没有当差的护院家丁。）');""",
"""    notices.push(names.length
      ? `${names.join('、')}共 ${names.length} 人到了议事厅候令（其余照旧守各处）。`
      : '（宅里此刻没有当差的护院家丁。）');""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('只提一班 8 人')
