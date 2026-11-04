import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find('  // 产业必须挂在具体地点上')
end = s.find('  // 孤儿雇工：', start)
if start < 0 or end < 0:
    print('WARN: 区块没找到')
else:
    block = '''  // 产业只做"认领"：把自己挂到同名/近名的地点上。
  // 不在读档时新建或删除地点——地图的增删只由造物入口和清理入口做。
  try {
    world.assets = world.assets || {};
    for (const prop of (world.assets.properties || [])) {
      if (!prop || !prop.name) continue;
      const nm = String(prop.name);
      if (prop.placeId && world.places?.[prop.placeId]) {
        const onDuty = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.location === prop.placeId);
        const dutyIds = new Set(onDuty.map((a) => a.id));
        if (Array.isArray(prop.staffIds)) prop.staffIds = prop.staffIds.filter((id) => dutyIds.has(id));
        prop.staff = onDuty.length;
        continue;
      }
      const hit = Object.entries(world.places || {}).find(([, pl]) => {
        const pn = String(pl?.name || '');
        if (!pn) return false;
        if (pn === nm) return true;
        const near = Math.abs(pn.length - nm.length) <= 2;
        return near && (pn.includes(nm) || nm.includes(pn));
      });
      if (hit) {
        prop.placeId = hit[0];
        hit[1].property = true;
        hit[1].owner = hit[1].owner || prop.owner || 'husband';
        console.log(`[Prop] ${nm} 认领地点 ${hit[0]}`);
      }
    }
  } catch { /* 忽略 */ }

'''
    s = s[:start] + block + s[end:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('已改为只认领，不动地图')

# 孤儿雇工块也挪到后面以免顺序问题：保持不变
