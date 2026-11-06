import io
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (badName || !shopSuffix || name.length < 2 || name.length > 12) {"""
new = """        // 客房/上房不是产业：睡觉的地方不该进"名下产业"账
        if (/上房|客房|房间|厢房|卧房|雅间/.test(name)) {
          applied.push(`忽略产业：「${name}」是客房不是铺子`);
          continue;
        }
        if (badName || !shopSuffix || name.length < 2 || name.length > 12) {"""
if old in s and '客房/上房不是产业' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('房间不立产业')

@'
import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：所有城的铺面配人"
add = """      // 一次性：清掉被误立成产业的客房/上房
      try {
        if (!world.flags?.roomPropFixV1) {
          const before = (world.assets?.properties || []).length;
          world.assets.properties = (world.assets.properties || []).filter((p) => !(p && /上房|客房|房间|厢房|卧房|雅间/.test(String(p.name || ''))));
          const removed = before - world.assets.properties.length;
          world.flags = world.flags || {};
          world.flags.roomPropFixV1 = { at: Date.now(), removed };
          if (removed) console.log(`[Property] 清掉误立的客房产业：${removed} 处`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'roomPropFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('清理客房产业')
