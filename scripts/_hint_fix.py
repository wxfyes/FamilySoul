import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "      contextHintEarly += '（【物价参考】${priceHint()}。报钱一律照这个来，不许编出\"一晚房钱三两\"这种价。）\\n';"
new = "      contextHintEarly += `（【物价参考】${priceHint()}。报钱一律照这个来，不许编出\"一晚房钱三两\"这种价。）\\n`;"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('价目参考改为模板字符串')
else:
    print('未匹配，检查当前行：')
    for line in s.split('\n'):
        if '【物价参考】' in line:
            print('   ', line.strip()[:120])
