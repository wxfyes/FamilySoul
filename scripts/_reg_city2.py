import io
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      try {
        if (world.places.street) {
          world.places.street.exits = Array.isArray(world.places.street.exits) ? world.places.street.exits : [];
          if (!world.places.street.exits.includes(houseId)) world.places.street.exits.push(houseId);
        }
      } catch { /* 忽略 */ }"""
new = """      try {
        const st = world.places[streetId];
        if (st) {
          st.exits = Array.isArray(st.exits) ? st.exits : [];
          if (!st.exits.includes(houseId)) st.exits.push(houseId);
        }
      } catch { /* 忽略 */ }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 家门连本城街（改）')

old2 = """      schedule: [
        { at: 8, do: '在客栈大堂用早茶', place: 'inn' },
        { at: 12, do: '在前街漫步采风', place: 'street' },
        { at: 20, do: '回客栈大堂歇息', place: 'inn' },
      ],"""
new2 = """      schedule: [
        { at: 8, do: '在街上走一走', place: streetId },
        { at: 12, do: '在城里找活计', place: streetId },
        { at: 20, do: '回自己的小院歇息', place: houseId },
      ],"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 作息用本城地点')
io.open(p, 'w', encoding='utf-8-sig').write(s)
