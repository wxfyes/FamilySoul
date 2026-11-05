import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
# 恢复 goods 负载（商货行栈要用）
old = "        prices: (() => {"
new = """        goods: (() => {
          try { return goodsSnapshot(world); } catch { return null; }
        })(),
        prices: (() => {"""
if 'goods: (() => {' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 恢复 goods 负载')
