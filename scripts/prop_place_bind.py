import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

mig = """export function migrateOwnership(world) {
  // 产业必须挂在具体地点上：不然请了人也没处站、收入也没处算
  try {
    world.assets = world.assets || {};
    const props = Array.isArray(world.assets.properties) ? world.assets.properties : [];
    world.places = world.places || {};
    for (const prop of props) {
      if (!prop || !prop.name) continue;
      const nm = String(prop.name);
      if (prop.placeId && world.places[prop.placeId]) continue;

      // ① 先找同名或包含关系的地点（含"三层/大"这类修饰）
      const cands = Object.entries(world.places).filter(([, pl]) => {
        const pn = String(pl?.name || '');
        return pn && (pn === nm || pn.includes(nm) || nm.includes(pn));
      });
      if (cands.length) {
        // 优先取 id 与产业一致的那个，其次取名字最接近的
        cands.sort((a, b) => {
          const sa = a[0] === prop.id ? 0 : 1;
          const sb = b[0] === prop.id ? 0 : 1;
          if (sa !== sb) return sa - sb;
          return Math.abs(a[1].name.length - nm.length) - Math.abs(b[1].name.length - nm.length);
        });
        const [keepId, keepPl] = cands[0];
        prop.placeId = keepId;
        keepPl.name = nm;              // 以产业名为准
        keepPl.owner = keepPl.owner || prop.owner || 'husband';
        keepPl.property = true;
        // 合并同名重复地点：人改指过来，旧地点删掉
        for (const [dupId] of cands.slice(1)) {
          if (dupId === keepId) continue;
          for (const a of Object.values(world.actors || {})) {
            if (a && a.location === dupId) a.location = keepId;
          }
          delete world.places[dupId];
          if (world.dynamicPlaces) delete world.dynamicPlaces[dupId];
        }
        console.log(`[Prop] ${nm} 挂到地点 ${keepId}`);
      } else {
        // ② 世上还没有这处 → 就地立一处，挂在码头或长街下
        const parent = world.places.dock ? 'dock' : (world.places.street ? 'street' : null);
        const id = prop.id || `prop_place_${Object.keys(world.places).length + 1}`;
        world.places[id] = {
          id, name: nm, exits: parent ? [parent] : [], dynamic: true,
          property: true, owner: prop.owner || 'husband', createdDay: world.clock?.day || 1,
        };
        world.dynamicPlaces = world.dynamicPlaces || {};
        world.dynamicPlaces[id] = world.places[id];
        prop.placeId = id;
        console.log(`[Prop] ${nm} 立了地点 ${id}`);
      }
      // 在册人手：有 staffIds 就按实际在岗刷新人数
      const onDuty = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.location === prop.placeId);
      prop.staff = onDuty.length;
    }
  } catch { /* 忽略 */ }"""

anchor = "export function migrateOwnership(world) {"
if anchor in s and '产业必须挂在具体地点上' not in s:
    s = s.replace(anchor, mig, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 加产业-地点绑定迁移')
else:
    print('已存在或未找到锚点')
