import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const who = Object.values(wPres.actors || {}).find((a) => a && !a.dead && a.name && (a.name === spk || spk.includes(a.name) || a.name.includes(spk)));
        if (who && who.location !== hereLoc) {"""
new = """        const who = Object.values(wPres.actors || {}).find((a) => a && !a.dead && a.name && (a.name === spk || spk.includes(a.name) || a.name.includes(spk)));
        // 真人角色（别的玩家在操作的号）不能被 AI 代他说话；只有"亲眷隔空应声"这一种例外
        if (who && who.id !== mePres?.id) {
          const rel2 = mePres?.relations?.[who.id] || who.relations?.[mePres?.id] || {};
          const kin2 = Boolean(mePres?.spouse === who.id || who.spouse === mePres?.id
            || (mePres?.household && who.household)
            || rel2.lover || Number(rel2.desire) >= 40 || Number(rel2.trust) >= 55);
          if (isHumanBound(wPres, who.id) && !kin2) {
            console.log(`[Presence] 剔除非本人操控的真人发言：${spk}`);
            continue;
          }
        }
        if (who && who.location !== hereLoc) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 真人号不许被代演（亲眷例外）')
