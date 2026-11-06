import io
# ① 经营场所的房间分级：前堂公开，后厨/库房/后坊只许当差的进
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, floor: room.floor, access: 'shop_floor' };"""
new = """      // 前堂/雅阁可待客，后厨、库房、后坊、酒窖是当差的地方，外人止步
      const publicUse = room.use === 'shop_floor' || room.use === 'hall';
      p.rooms[room.key] = {
        id: rid, name: room.name, use: room.use, floor: room.floor,
        access: publicUse ? 'public_shop' : 'staff_only',
      };"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 经营场所房间分级')
