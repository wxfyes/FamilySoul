import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

# 用产业记录里的规模判断宅子等第（七进大宅 → 7）
old = """        const r = ensureResidence(world, pid);"""
new = """        // 产业的契纸上写了规模（如"七进大宅"），宅子就按那个等第建
        const prop = (world.assets?.properties || []).find((x) => x && (x.place === pid || (x.name && String(p.name || '').includes(String(x.name).split('（')[0]))));
        const scale = prop && /七进/.test(String(prop.name || '')) ? 7 : prop && /大宅|五进/.test(String(prop.name || '')) ? 5 : 0;
        const r = ensureResidence(world, pid, { scale });"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 产业规模决定宅第')

# 迁移 v2：把已建但等第偏低的宅子升级，并补安置眷属
anchor = "  // 一次性：给所有宅子建出院子"
if 'residencesBuiltV2' not in s:
    add = """  // 一次性 v2：宅子按契纸规模升等（七进大宅就该有七进的院子），并安置眷属quarters
  try {
    world.flags = world.flags || {};
    if (!world.flags.residencesBuiltV2) {
      let up = 0;
      for (const [pid, p] of Object.entries(world.places || {})) {
        if (!p || !p.rooms) continue;
        const prop = (world.assets?.properties || []).find((x) => x && (x.place === pid || (x.name && String(p.name || '').includes(String(x.name).split('（')[0]))));
        const scale = prop && /七进/.test(String(prop.name || '')) ? 7 : prop && /大宅|五进/.test(String(prop.name || '')) ? 5 : 0;
        const r = ensureResidence(world, pid, { scale });
        if (r.built) up += 1;
        assignStaffQuarters(world, pid);
      }
      world.flags.residencesBuiltV2 = { day: world.clock?.day || 1, upgraded: up };
      if (up) console.log(`[Residence] 升级 ${up} 座宅院`);
    }
  } catch { /* 忽略 */ }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('② 迁移 v2 升宅第')
