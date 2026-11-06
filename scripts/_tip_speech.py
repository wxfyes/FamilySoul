import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const speech = segs.filter((x) => /^【[^】]+】/.test(x) && !/(就站在|四下冷清|你到了)/.test(x));"""
new = """      // 【提示】不是人说话，不能算进"几个人抢话"，更不能被只留第一个说话人时丢掉
      const speech = segs.filter((x) => /^【[^】]+】/.test(x)
        && !/^【提示】/.test(x)
        && !/(就站在|四下冷清|你到了)/.test(x));"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('提示不算抢话')
