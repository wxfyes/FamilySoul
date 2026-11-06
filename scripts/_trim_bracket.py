import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        let merged = kept.join('').trim();"""
new = """        let merged = kept.join('').trim();
        // 末尾残缺括号 / 孤立左括号，一律清掉（观感）
        merged = merged.replace(/[（(]\\s*$/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();"""
if old in s and '末尾残缺括号' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('清末尾残括号')
