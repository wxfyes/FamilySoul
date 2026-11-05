import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        let merged = kept.join('').trim();"""
new = """        let merged = kept.join('').trim();
        // 引擎标签绝不能漏到戏里给相公看（[[spawn:柳婶|…]] 这类）
        merged = merged.replace(/\\[\\[[^\\]\\n]{1,60}\\]\\]/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();"""
if old in s and '引擎标签绝不能漏到戏里' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 出口清掉引擎标签')
