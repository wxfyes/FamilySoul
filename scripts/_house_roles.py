import io
# ③ 后院内容只列女眷与贴身丫鬟，不列护院家丁
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            (a) => a && !a.dead && a.id !== 'husband'
              // 只算真在相公府里的：同住一处，或是他的妻妾；别人的府不算
              && (a.spouse === 'husband' || Boolean(meL?.home && a.home === meL.home)
                || Boolean(a.household && meL?.home && a.home === meL.home)),"""
new = """            (a) => a && !a.dead && a.id !== 'husband'
              // 后院内容 = 妻妾与贴身丫鬟；护院家丁在"府内当差"，不算内眷
              && (a.spouse === 'husband'
                || (/妻|夫人|妾|姨娘|通房|丫鬟|婆子|嬷嬷|姑娘|小姐/.test(String(a.role || ''))
                  && Boolean(meL?.home && a.home === meL.home))),"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 后院只列内眷')
