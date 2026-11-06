import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """              if (pl.parent) {
              if (pl.parent === myHome || pl.parent === curId) return true;"""
old2 = """            if (pl.parent) {
              if (pl.parent === myHome || pl.parent === curId) return true;"""
new = """            if (pl.parent) {
              // 只列公开的地方：前堂、门厅、院子；后厨库房雅间卧房一律不列
              const pubAccess = pl.access === 'public_outer' || pl.access === 'guest_main' || pl.access === 'guest_outer' || pl.access === 'public_shop';
              const pubUse = pl.use === 'shop_floor' || pl.use === 'hall' || pl.use === 'gate' || pl.use === 'yard';
              if (!(pubAccess && pubUse)) return false;
              if (pl.parent === myHome || pl.parent === curId) return true;"""
if old2 in s:
    s = s.replace(old2, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('④ 菜单只列公开房')
