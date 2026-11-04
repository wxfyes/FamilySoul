import io
p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (f?.kind === 'place') {"""
new = """    if (f?.kind === 'staff') {
      const propName = String(f?.who || '');
      const prop = (world.assets?.properties || []).find((x) => x && String(x.name).includes(propName));
      const newName = String(f?.name || '').trim();
      if (prop && prop.placeId && world.places?.[prop.placeId] && newName.length >= 2) {
        let a = Object.values(world.actors || {}).find((x) => x && x.name === newName);
        if (!a) {
          const id = `npc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          a = { id, name: newName, role: String(f?.role || '伙计').slice(0, 8), gender: 'unknown',
            home: prop.placeId, work: prop.placeId, location: prop.placeId,
            money: 0, relations: {}, schedule: [], origin: 'dm_hired', createdDay: world.clock?.day || 1 };
          world.actors[id] = a;
        } else {
          a.location = prop.placeId;
        }
        prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
        if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
        prop.staff = prop.staffIds.length;
        fixed += 1;
      }
      continue;
    }

    if (f?.kind === 'place') {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('已插入 staff 落账')
