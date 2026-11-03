import io
p = 'src/world/proxy-actor.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "`${hearerName || '对方'}说：${said}`,"
new = "`${hearerName || '对方'}说：${said}`,\n      '（先正面回应对方这句话；你自己的心事、恩怨只在与这句话有关时提一句，不许自说自话。）',"
if old in s and '先正面回应对方这句话' not in s:
    s = s.replace(old, new, 1)
    print('patched: proxy answers first')
io.open(p, 'w', encoding='utf-8').write(s)
