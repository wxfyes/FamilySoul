import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        || /让.{0,10}(走|回去|回房|退下|出去|散了)/.test(String(sayText || ''))
        || /叫他们.{0,4}(走|回去|出去)|都回(房|屋|去)|散了吧|退下/.test(String(sayText || ''))
        || /(?:回|进)(?:房|屋)(?:间|去|里)?|回去歇着|各自回/.test(String(sayText || ''));"""
new = """        || /让.{0,10}(走|回去|回房|退下|出去|散了)/.test(String(sayText || ''))
        || /叫他们.{0,4}(走|回去|出去)|都回(房|屋|去)|散了吧|退下/.test(String(sayText || ''))
        || /(?:回|进)(?:房|屋)(?:间|去|里)?|回去歇着|各自回/.test(String(sayText || ''))
        || /^\\s*出去吧?[。！!~…\\s]*$/.test(String(sayText || '').trim())
        || /([\\u4e00-\\u9fa5]{2,4})\\s*(?:先)?\\s*(?:出去|退下|退出去|走吧|回房)/.test(String(sayText || '').trim());"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('出去/退下话术')
