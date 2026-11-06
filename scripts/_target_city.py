import io
# 去哪：语义找地点时优先本城
p = 'src/world/places-target.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { streetOfCity } from './city.js';", "import { streetOfCity, cityOfPlace } from './city.js';", 1)
old = """function score(p, nearId, actor, hint = '') {
  let s = 0;"""
new = """let __myCity = '';
function score(p, nearId, actor, hint = '') {
  let s = 0;
  const pc = __myCity ? cityOfPlace({ cities: __citiesRef, places: __placesRef }, p.id) : '';
  if (__myCity && pc && pc !== __myCity) s -= 8;   // 别把人送到别的城
  if (__myCity && pc && pc === __myCity) s += 4;"""
if old in s and '__myCity' not in s:
    s = s.replace(old, new, 1)
    # 在 resolve 里设置当前城
    s = s.replace("""  const text = String(hint || '');""",
"""  const text = String(hint || '');
  __citiesRef = world?.cities || {};
  __placesRef = world?.places || {};
  __myCity = nearId ? cityOfPlace(world, nearId) : '';""", 1)
    s = s.replace("let __myCity = '';", "let __myCity = '';\nlet __citiesRef = {};\nlet __placesRef = {};", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('语义优先本城')
