import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        || /([\\u4e00-\\u9fa5]{2,4})\\s*(?:先)?\\s*(?:出去|退下|退出去|走吧|回房)/.test(String(sayText || '').trim());"""
new = """        || /([\\u4e00-\\u9fa5]{2,4})\\s*(?:先)?\\s*(?:出去|退下|退出去|走吧|回房)/.test(String(sayText || '').trim())
        || /都[^。]{0,4}(出去|退下|散了|退出去|回去)/.test(String(sayText || '').trim())
        || (/留下/.test(String(sayText || '')) && /都|出去|散/.test(String(sayText || '')));"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('都出去，X留下 识别')
