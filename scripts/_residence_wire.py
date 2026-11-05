import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'residence.js' not in s:
    s = s.replace("import { linkCouples } from './couples.js';",
                  "import { linkCouples } from './couples.js';\nimport { ensureResidence, assignStaffQuarters } from './residence.js';")
    anchor = "  // 一次性 v2：修悬空配偶（指向已不存在的人），再重新结对"
    add = """  // 一次性：给所有宅子建出院子（正房/厢房/庖厨/下房/库房/倒座房…），不再是一个空点
  try {
    world.flags = world.flags || {};
    if (!world.flags.residencesBuilt) {
      let homes = 0; let rooms = 0;
      for (const [pid, p] of Object.entries(world.places || {})) {
        if (!p) continue;
        const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);
        if (!looksHome) continue;
        if (/客栈|酒|茶|铺|坊|仓|衙|庙|观|祠(?!堂)/.test(String(p.name || '')) && !p.residence) continue;
        const r = ensureResidence(world, pid);
        if (r.built) { homes += 1; rooms += r.rooms; assignStaffQuarters(world, pid); }
      }
      world.flags.residencesBuilt = { day: world.clock?.day || 1, homes, rooms };
      if (homes) console.log(`[Residence] 建出 ${homes} 座宅院，共 ${rooms} 个院子`);
    }
  } catch { /* 忽略 */ }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('① 迁移：给宅子建院子')

# 新玩家小院也建
if 'ensureResidence(world, houseId' not in s:
    old = """    world.places[houseId] = {"""
    idx = s.find(old)
    if idx > 0:
        # 找到该对象结束（下一个 "};\n"）
        end = s.find('};', idx)
        if end > 0:
            ins = "\n    try { ensureResidence(world, houseId); } catch { /* 忽略 */ }"
            s = s[:end+2] + ins + s[end+2:]
            io.open(p, 'w', encoding='utf-8-sig').write(s)
            print('② 新玩家小院建院子')
