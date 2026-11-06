import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 单人叫：男仆/护院一律到议事厅，不许进内室
old = """          const own = String(target.spouse || '') === 'husband' || String(target.householdOwner || '') === String(meC?.id);
          // 不是自家的人：只能到厅上候着，未得通报不进内室
          let dest = meC.location;
          if (!own) {"""
new = """          const own = String(target.spouse || '') === 'husband' || String(target.householdOwner || '') === String(meC?.id);
          // 外院当差的（家丁/护院/门房/小厮/马夫）不进内室，只到厅上
          const outerStaff = /家丁|护院|门房|小厮|马夫|车夫|脚夫|更夫/.test(String(target.role || ''));
          // 不是自家的人、或是外院当差的：只能到厅上候着
          let dest = meC.location;
          if (!own || outerStaff) {"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 男仆只到厅')
# 提示措辞区分
s = s.replace("""            reply += own
              ? `\\n【提示】${target.name}到了跟前。`
              : `\\n【提示】${target.name}到了厅上候着，未得通报，不敢进内室。`;""",
"""            reply += (own && !outerStaff)
              ? `\\n【提示】${target.name}到了跟前。`
              : `\\n【提示】${target.name}到了议事厅候着，没得传唤不进内室。`;""", 1)

# 集体叫：护院家丁不去内室，只在厅上列队
old2 = """        for (const a of Object.values(wAll.actors || {})) {
          if (!a || a.dead || a.id === meAll.id) continue;
          const kin = String(a.spouse || '') === 'husband' || String(a.householdOwner || '') === String(meAll.id);
          if (!kin || a.location === meAll.location) continue;"""
new2 = """        const hallId = (() => {
          const rooms = wAll.places?.[meAll?.home]?.rooms || {};
          return rooms.hall?.id || Object.keys(wAll.places || {}).find((id) => /中堂|议事|大厅|门厅/.test(String(wAll.places[id]?.name || id))) || null;
        })();
        for (const a of Object.values(wAll.actors || {})) {
          if (!a || a.dead || a.id === meAll.id) continue;
          const kin = String(a.spouse || '') === 'husband' || String(a.householdOwner || '') === String(meAll.id);
          if (!kin || a.location === meAll.location) continue;
          // 护院家丁只在议事厅列队
          if (/家丁|护院|门房|小厮|马夫|脚夫/.test(String(a.role || ''))) {
            if (!hallId) continue;
            const mvH = moveActor(wAll, a.id, hallId, 'world', '厅上候令');
            if (mvH?.ok) names.push(`${a.name}（厅上）`);
            continue;
          }"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 集体：护院去厅')
io.open(p, 'w', encoding='utf-8-sig').write(s)
