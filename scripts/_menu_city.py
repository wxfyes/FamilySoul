import io
# 菜单：只列本城的地方（临江老地点算临江）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { ensureCityBase, streetOfCity } from './world/city.js';",
              "import { ensureCityBase, streetOfCity, cityOfPlace } from './world/city.js';", 1)
old = """        const nearScore = ([id, pl]) => {"""
new = """        const myCity = curPlace ? cityOfPlace(world, curId) : '';
        const nearScore = ([id, pl]) => {"""
if old in s and 'myCity' not in s:
    s = s.replace(old, new, 1)
    print('menu 取本城')
old2 = """          .filter(([id, pl]) => {
            if (id === curId || !pl || !pl.name || pl.private) return false;"""
new2 = """          .filter(([id, pl]) => {
            if (id === curId || !pl || !pl.name || pl.private) return false;
            // 只列本城的地方：成都的人不该看见临江的铺子
            if (myCity) {
              const pc = cityOfPlace(world, id);
              if (pc && pc !== myCity) return false;
              if (!pc && myCity !== '临江府') return false;
            }"""
if old2 in s and '只列本城的地方' not in s:
    s = s.replace(old2, new2, 1)
    print('menu 过滤外城')
io.open(p, 'w', encoding='utf-8-sig').write(s)
