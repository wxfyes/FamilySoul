import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
# 单人：厅 = 议事厅
s = s.replace("""            dest = homeRooms.hall?.id || Object.keys(wC.places || {}).find((id) => /hall|中堂|议事/.test(String(wC.places[id]?.name || id))) || meC.location;""",
"""            dest = Object.keys(wC.places || {}).find((id) => /议事厅/.test(String(wC.places[id]?.name || '')))
              || homeRooms.hall?.id
              || Object.keys(wC.places || {}).find((id) => /hall|中堂/.test(String(wC.places[id]?.name || id)))
              || meC.location;""", 1)
# 集体：厅 = 议事厅
s = s.replace("""        const hallId = (() => {
          const rooms = wAll.places?.[meAll?.home]?.rooms || {};
          return rooms.hall?.id || Object.keys(wAll.places || {}).find((id) => /中堂|议事|大厅|门厅/.test(String(wAll.places[id]?.name || id))) || null;
        })();""",
"""        const hallId = (() => {
          const byName = Object.keys(wAll.places || {}).find((id) => /议事厅/.test(String(wAll.places[id]?.name || '')));
          if (byName) return byName;
          const rooms = wAll.places?.[meAll?.home]?.rooms || {};
          return rooms.hall?.id || Object.keys(wAll.places || {}).find((id) => /中堂|大厅|门厅/.test(String(wAll.places[id]?.name || id))) || null;
        })();""", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('厅=议事厅')
