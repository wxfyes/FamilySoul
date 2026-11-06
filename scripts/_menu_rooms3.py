import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            if (pl.parent) return pl.parent === myHome || pl.parent === curId;
            return true;"""
new = """            if (pl.parent) {
              if (pl.parent === myHome || pl.parent === curId) return true;
              // 公开营业场所（酒楼/茶坊/衙署/客栈）的院子也列出来，雅阁、天字阁才搜得到
              const par = world.places?.[pl.parent];
              const pub = par && (par.use === 'restaurant' || par.use === 'shop' || par.use === 'court'
                || /酒楼|茶坊|茶栈|客栈|衙署|县衙|码头/.test(String(par.name || '')));
              return Boolean(pub);
            }
            return true;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 公开场所的院子进菜单')
