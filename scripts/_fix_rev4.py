import io
p = 'src/world/strategy.js'
s = io.open(p, encoding='utf-8-sig').read()
# 枭雄自立也走产权唯一入口
s = s.replace("import { recruit, besiege, bribeCity, buyGrain, march, troopsAt, totalTroops, fortify } from './warfare.js';",
              "import { recruit, besiege, bribeCity, buyGrain, march, troopsAt, totalTroops, fortify, changeCityOwner } from './warfare.js';")
old = """  ct.owner = fid;
  ct.unrest = Math.max(0, num(ct.unrest) - 10);"""
new = """  changeCityOwner(world, cityName, fid);
  ct.unrest = Math.max(0, num(ct.unrest) - 10);"""
if old in s:
    s = s.replace(old, new, 1)
    print('枭雄自立走唯一入口')
io.open(p, 'w', encoding='utf-8-sig').write(s)
