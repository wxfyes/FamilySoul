import io

p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

# 删除 1391..1405（1-based）
start = 1390
end = 1405   # 不含
removed = lines[start:end]
if any('hisHist' in x for x in removed) and any('} catch' in x for x in removed):
    lines = lines[:start] + lines[end:]
    print('removed duplicate hisHist block + stray braces:', len(removed), 'lines')
else:
    print('WARN: unexpected content, not removed')
    for x in removed:
        print(repr(x))

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
