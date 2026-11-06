import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"""
new = """    try { console.log(`[DbgTip] reply 内含提示 ${(String(reply || '').match(/【提示】/g) || []).length} 条`); } catch { /* 忽略 */ }
    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"""
if old in s and 'DbgTip' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('调试日志')
