import io
p = 'src/world/strategy.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    else if (action === 'fortify') r = { ok: false, error: '暂未开放' };"
new = "    else if (action === 'fortify') r = fortify(world, fid, target, amount);"
if old in s:
    s = s.replace(old, new, 1)
    print('① 接上推演里的修城')
# 确保 fortify 已引入
if 'fortify' not in s.split('\n')[2]:
    s = s.replace("import { recruit, besiege, bribeCity, buyGrain, march, troopsAt, totalTroops } from './warfare.js';",
                  "import { recruit, besiege, bribeCity, buyGrain, march, troopsAt, totalTroops, fortify } from './warfare.js';")
    print('② 补 fortify 引入')
io.open(p, 'w', encoding='utf-8-sig').write(s)
