import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  if (hasLayout(root) && num(root.grade) >= grade) {
    relink();
    return { built: false, rooms: Object.keys(root.rooms).length, grade: num(root.grade) };
  }"""
new = """  const specLen = (LAYOUTS[grade] || LAYOUTS[3]).length;
  const haveRooms = Object.keys(root.rooms || {}).length;
  // 房间账残缺（被清过）也要按等第补齐，不能因为"有个门"就算有院子
  if (hasLayout(root) && num(root.grade) >= grade && haveRooms >= specLen) {
    relink();
    return { built: false, rooms: haveRooms, grade: num(root.grade) };
  }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('房间账残缺也补')
