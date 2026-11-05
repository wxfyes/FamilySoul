import io
# 门禁：外人不许直接闯进别人的正房/内院，先到大门
p = 'src/world/apply.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      // 移动发起者
      const oldLoc = actor.location;"""
new = """      // 门禁：别人的私宅，外人不许直接进正房内院——先到大门/门房
      try {
        const dest = world.places?.[finalTargetId];
        if (dest && dest.residence) {
          const owner = String(dest.owner || '');
          const meId = String(actor.id || '');
          const isFamily = actor.household || actor.spouse === 'husband' || meId === owner
            || (owner && world.actors?.[owner]?.household && actor.household);
          const invited = Boolean(actor.invitedBy && actor.invitedBy === owner);
          if (owner && owner !== meId && !isFamily && !invited) {
            const parentId = dest.parent || (owner === 'husband' ? 'husband_room' : '');
            const gateKey = 'gate';
            const gateId = parentId && world.places?.[parentId]?.rooms?.[gateKey]?.id;
            if (gateId && gateId !== finalTargetId) {
              const made = materializeRoom(world, parentId, gateKey);
              if (made) {
                console.log(`[Gate] ${actor.name} 想进${world.places?.[parentId]?.name || ''}内院，被门房拦在大门`);
                finalTargetId = made;
              }
            }
          }
        }
      } catch { /* 忽略 */ }

      // 移动发起者
      const oldLoc = actor.location;"""
if old in s and '被门房拦在大门' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 私宅门禁：先到大门')
