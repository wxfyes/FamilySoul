import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 单人叫：不是自家的人，只能到议事厅/中堂，不能进内室
old = """        if (target && target.location !== meC?.location) {
          const mv = moveActor(wC, target.id, meC.location, 'world', '叫到跟前');
          if (mv?.ok) {
            saveState(this.dataDir, wC);
            reply += `\\n（${target.name}应声到跟前来了。）`;
          } else {
            reply += `\\n（${target.name}一时过不来：${mv?.error || '路不通'}。）`;
          }
        }"""
new = """        if (target && target.location !== meC?.location) {
          const own = String(target.spouse || '') === 'husband' || String(target.householdOwner || '') === String(meC?.id);
          // 不是自家的人：只能到厅上候着，未得通报不进内室
          let dest = meC.location;
          if (!own) {
            const homeRooms = wC.places?.[meC?.home]?.rooms || {};
            dest = homeRooms.hall?.id || Object.keys(wC.places || {}).find((id) => /hall|中堂|议事/.test(String(wC.places[id]?.name || id))) || meC.location;
          }
          const mv = moveActor(wC, target.id, dest, 'world', own ? '叫到跟前' : '厅上候见');
          if (mv?.ok) {
            saveState(this.dataDir, wC);
            reply += own
              ? `\\n（${target.name}应声到跟前来了。）`
              : `\\n（${target.name}到了厅上候着，未得通报，不敢进内室。）`;
          } else {
            reply += `\\n（${target.name}一时过不来：${mv?.error || '路不通'}。）`;
          }
        }"""
if old in s:
    s = s.replace(old, new, 1)
    print('单人：外人只到厅')

# 集体叫：只叫自家人；外人一律不叫
old2 = """          const kin = String(a.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷/.test(String(a.role || ''));
          if (!kin || a.location === meAll.location) continue;"""
new2 = """          const kin = String(a.spouse || '') === 'husband' || String(a.householdOwner || '') === String(meAll.id);
          if (!kin || a.location === meAll.location) continue;"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('集体：只叫自家人')
io.open(p, 'w', encoding='utf-8-sig').write(s)
