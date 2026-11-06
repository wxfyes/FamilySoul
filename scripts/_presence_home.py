import io
# ① 家眷目标只在家里（不再上街）
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      { kind: 'market', text: '上街买些时新果子与针线', place: 'street' },
"""
if old in s:
    s = s.replace(old, "", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 家眷不上街')

# ② 开聊前：同宅内眷走到相公这间来
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "    // 8.7845 同宅女眷在别的屋里应了声"
add = """    // 8.7840 开聊先把同宅内眷请到这间来（同一座宅子里走动，不跨城）
    try {
      const wR0 = loadState(this.dataDir);
      const meR0 = wR0.actors?.[this._viewerActorId || 'husband'] || wR0.actors?.husband;
      const here = String(wR0.places?.[meR0?.location]?.name || '');
      const estate = here.includes('·') ? here.split('·').slice(0, 2).join('·') : '';
      if (estate && meR0?.location) {
        let moved = 0;
        for (const a of Object.values(wR0.actors || {})) {
          if (!a || a.dead || a.id === meR0.id) continue;
          const isKin = String(a.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷/.test(String(a.role || ''));
          if (!isKin || a.location === meR0.location) continue;
          const pname = String(wR0.places?.[a.location]?.name || '');
          if (!pname.startsWith(estate)) continue;
          const mv = moveActor(wR0, a.id, meR0.location, 'world', '到跟前说话');
          if (mv?.ok) moved += 1;
        }
        if (moved) { saveState(this.dataDir, wR0); console.log(`[Presence] ${moved} 位内眷到了跟前`); }
      }
    } catch { /* 忽略 */ }

""" + anchor
if '开聊先把同宅内眷请到这间来' not in t:
    t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 开聊请到跟前')
