with open('src/world/state.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

old_part = """    if (world.places?.teahouse_shop) {
      delete world.places.teahouse_shop;
      for (const a of Object.values(world.actors || {})) {
        if (a && a.location === 'teahouse_shop') a.location = 'tea_house';
        if (a && a.home === 'teahouse_shop') a.home = 'tea_house';
      }
    }
  } catch { /* 忽略 */ }"""

new_part = """    if (world.places?.teahouse_shop) {
      delete world.places.teahouse_shop;
      for (const a of Object.values(world.actors || {})) {
        if (a && a.location === 'teahouse_shop') a.location = 'tea_house';
        if (a && a.home === 'teahouse_shop') a.home = 'tea_house';
      }
    }
    // 清掉误建的雅阁等茶坊子地点，把人归并到 tea_house
    for (const [pid, p] of Object.entries(world.places || {})) {
      if (pid === 'tea_house') continue;
      const n = String(p?.name || '');
      if (/^(雅阁|二楼雅阁|茶坊雅阁|雅间|茶阁)$/.test(n) || (p?.dynamic && /雅阁/.test(n))) {
        delete world.places[pid];
        for (const a of Object.values(world.actors || {})) {
          if (a && a.location === pid) a.location = 'tea_house';
          if (a && a.home === pid) a.home = 'tea_house';
        }
      }
    }
  } catch { /* 忽略 */ }"""

assert old_part in text, "old_part not found in state.js"
text = text.replace(old_part, new_part, 1)

with open('src/world/state.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("state.js patched successfully!")

