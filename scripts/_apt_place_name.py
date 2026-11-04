import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """    // 约定的地点：优先记下的地点，否则就是对方此刻所在
    const apTargetPlace = (w, ap) => ap?.place || w.actors?.[ap?.actorId]?.location || null;"""
new = """    // 约定的地点：优先记下的地点，否则就是对方此刻所在（老记录没 actorId 就按名字找）
    const apTargetPlace = (w, ap) => {
      if (!ap) return null;
      if (ap.place && w.places?.[ap.place]) return ap.place;
      const byId = ap.actorId ? w.actors?.[ap.actorId] : null;
      if (byId?.location) return byId.location;
      const byName = Object.values(w.actors || {}).find((a) => a && a.name === ap.name);
      return byName?.location || null;
    };"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 兜底按名字找')

old2 = """            place: ap.place || (world.actors?.[ap.actorId]?.location || ''),
            placeName: (() => {
              const pid = ap.place || world.actors?.[ap.actorId]?.location;
              return pid ? (world.places?.[pid]?.name || '') : '';
            })(),"""
new2 = """            place: apTargetPlace(world, ap) || '',
            placeName: (() => {
              const pid = apTargetPlace(world, ap);
              return pid ? (world.places?.[pid]?.name || '') : '';
            })(),"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② menu 用同一个函数')
io.open(p, 'w', encoding='utf-8').write(s)
print('done')
