import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (assistantMsg && typeof reply === 'string' && reply !== assistantMsg.text) {
      assistantMsg.text = reply;"""
new = """    if (assistantMsg && typeof reply === 'string') {
      try {
        const cleanedLast = this._stripIllegalSpeakers(reply);
        if (cleanedLast) reply = cleanedLast;
      } catch { /* 忽略 */ }
    }
    if (assistantMsg && typeof reply === 'string' && reply !== assistantMsg.text) {
      assistantMsg.text = reply;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 最终落记录前再滤一次')
