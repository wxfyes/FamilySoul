import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      reply = String(reply || '').split('\\n').filter((ln) => !/^\\s*[（(][^）)]{0,40}(起身告辞|退了出去|告退|退下|告退出去)[^）)]{0,20}[）)]\\s*$/.test(ln)).join('\\n');"""
new = """      // 括号里凡是"谁走了/退了出去"的叙述，一律删；离场事实只由引擎追加
      reply = String(reply || '').replace(/[（(][^（）()]{0,80}(起身告辞|退了出去|退了出去。|告退出去|都退下了|退出去了)[^（）()]{0,40}[）)]/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('括号离场叙述全删')
