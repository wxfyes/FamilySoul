import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "            (a) => a && !a.dead && a.id !== 'husband' && (a.household || (meL?.home && a.home === meL.home)),"
new = """            (a) => a && !a.dead && a.id !== 'husband'
              // 只算真在相公府里的：同住一处，或是他的妻妾；别人的府不算
              && (a.spouse === 'husband' || Boolean(meL?.home && a.home === meL.home)
                || Boolean(a.household && meL?.home && a.home === meL.home)),"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('server life ok')
