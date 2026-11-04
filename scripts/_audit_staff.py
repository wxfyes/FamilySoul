import io
p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 提示词：产业没人就点人
old = "    '拿不准的可以跳过，宁缺毋滥。',"
new = """    '若某个产业开着却没人在岗，就在 fixes 里给一条 {"kind":"staff","who":"产业名","name":"人名","role":"身份"}，起个像样的名字。',
    '拿不准的可以跳过，宁缺毋滥。',"""
if old in s and '"kind":"staff"' not in s:
    s = s.replace(old, new, 1)
    print('① 提示补产业招人')

# ② 落账：staff 修法
old2 = """    if (f?.kind === 'place') {"""
new2 = """    if (f?.kind === 'staff') {
      const propName = String(f?.who || '');
      const prop = (world.assets?.properties || []).find((x) => x && String(x.name).includes(propName));
      const newName = String(f?.name || '').trim();
      if (prop && prop.placeId && world.places?.[prop.placeId] && /^[\\u4e00-\\u9fa5]{2,4}$/.test(newName)) {
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
    }

    if (f?.kind === 'place') {"""
if old2 in s and "'staff'" not in s:
    s = s.replace(old2, new2, 1)
    print('② 落账支持产业招人')
io.open(p, 'w', encoding='utf-8-sig').write(s)
