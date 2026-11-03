import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        '关系：[[world:bond a=aji b=wangpo type=母子 score=40]] —— 剧情里出现认亲、拜把子、结仇时用；score 正为亲近、负为仇怨。',"
new = (
    "        '关系：[[world:bond a=aji b=wangpo type=母子 score=40]] —— 剧情里出现认亲、拜把子、结仇时用；score 正为亲近、负为仇怨。',\n"
    "        '挑唆：[[world:bond a=\"张三\" b=\"李四\" type=嫌隙 score=-15]] —— 相公搬弄是非、说谁坏话、告状时，把被他挑唆的两个人之间的关系往下压；每挑一次 -10 ~ -20。',"
)
if old in s and '挑唆：' not in s:
    s = s.replace(old, new, 1)
    print('taught bookkeeper to provoke')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
