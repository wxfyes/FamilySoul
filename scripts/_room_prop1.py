import io
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        if (badName || !shopSuffix || name.length < 2 || name.length > 12) {"
new = """        // 客房/上房不是产业：睡觉的地方不该进"名下产业"账
        if (/上房|客房|房间|厢房|卧房|雅间/.test(name)) {
          applied.push(`忽略产业：「${name}」是客房不是铺子`);
          continue;
        }
        if (badName || !shopSuffix || name.length < 2 || name.length > 12) {"""
if old in s and '客房/上房不是产业' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('dispatch ok')
