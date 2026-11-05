import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      if (turnTarget && turnTarget.actor) {
        const tActor = turnTarget.actor;"""
new = """      // 指名的人不在场，就不能把发言权交给他（否则他会隔空开腔）
      if (turnTarget && turnTarget.actor && turnTarget.actor.location !== myLoc) {
        console.log(`[TurnTarget] 指名者不在场：${turnTarget.actor.name}（此刻在${wTurn.places?.[turnTarget.actor.location]?.name || '别处'}），改由在场者接话`);
        turnTarget = resolveTurnTarget({ world: wTurn, viewerId: myActorId, say: '', present: hereActors });
      }
      if (turnTarget && turnTarget.actor) {
        const tActor = turnTarget.actor;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 指名者不在场则不交发言权')
