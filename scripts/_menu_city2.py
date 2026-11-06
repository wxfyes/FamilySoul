import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """              const fullName = `${houseName}·${rec.name}`;"""
new = """              const fullName = `${houseName}·${rec.name}`;
              // 虚拟补进来的院子也要与本城一致（别把临江的衙署房间列到外城）
              if (myCity) {
                const seg0 = String(parent.name || '').split('·')[0];
                const pCity = /府$|州$|县$/.test(seg0) ? seg0 : '临江府';
                if (pCity !== myCity) continue;
              }"""
if old in s and '与本城一致' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('虚拟房间也限本城')
