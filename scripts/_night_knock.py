import io
p = 'src/world/visit.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  if (night && !kin && trust < 60) return { allowed: false, reason: keeperAtGate ? `${keeperName}说天黑了、主人已歇下，请你明早再来` : '夜里没人应门，里头都歇下了，请明早再来', place: null, owner, hall: null, keeper: keeperName };"""
new = """  // 夜里也能通传：有看门的，披衣起来问一声；真有急事，主人让进就进
  if (night && !kin && trust < 60) {
    if (!keeper) return { allowed: false, reason: '夜里没人应门，里头都歇下了，请明早再来', place: null, owner, hall: null, keeper: '' };
    if (!ownerHere) {
      return { allowed: false, reason: `${keeperName}披衣起来应了门，说主人不在府里，有急事可留下话、明早再递`, place: null, owner, hall: null, keeper: keeperName };
    }
    const hallKeyN = ['hall', 'main', 'reception'].find((k) => home.rooms?.[k]);
    const hallN = hallKeyN ? home.rooms[hallKeyN].id : null;
    return { allowed: true, reason: `${keeperName}披衣起来通了传，主人听说有急事，让请进偏厅说话`, place: hallN || home.id, owner, hall: hallN, keeper: keeperName };
  }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 夜里可通传（有门房、主人在）')
