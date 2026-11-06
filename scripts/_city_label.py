import io
# 菜单：按"地点名前缀"判城（更可靠）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const myCity = curPlace ? cityOfPlace(world, curId) : '';"""
new = """        const labelOf = (nm) => {
          const seg = String(nm || '').split('·')[0];
          return /府$|州$|县$/.test(seg) ? seg : '临江府';
        };
        const myCity = curPlace ? labelOf(curPlace.name) : '';"""
if old in s:
    s = s.replace(old, new, 1)
    print('① menu 用前缀判城')
old2 = """            if (myCity) {
              const pc = cityOfPlace(world, id);
              if (pc && pc !== myCity) return false;
              if (!pc && myCity !== '临江府') return false;
            }"""
new2 = """            if (myCity && labelOf(pl.name) !== myCity) return false;"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 过滤改前缀')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# 去哪：候选按前缀同城加分
p2 = 'src/world/places-target.js'
t = io.open(p2, encoding='utf-8-sig').read()
old3 = """let __myCity = '';
let __citiesRef = {};
let __placesRef = {};
function score(p, nearId, actor, hint = '') {
  let s = 0;
  const pc = __myCity ? cityOfPlace({ cities: __citiesRef, places: __placesRef }, p.id) : '';
  if (__myCity && pc && pc !== __myCity) s -= 8;   // 别把人送到别的城
  if (__myCity && pc && pc === __myCity) s += 4;"""
new3 = """let __myCity = '';
function score(p, nearId, actor, hint = '') {
  let s = 0;
  const labelOf = (nm) => {
    const seg = String(nm || '').split('·')[0];
    return /府$|州$|县$/.test(seg) ? seg : '临江府';
  };
  const pc = labelOf(p.name);
  if (__myCity && pc !== __myCity) s -= 8;   // 别把人送到别的城
  if (__myCity && pc === __myCity) s += 4;"""
if old3 in t:
    t = t.replace(old3, new3, 1)
    t = t.replace("""  __citiesRef = world?.cities || {};
  __placesRef = world?.places || {};
  __myCity = nearId ? cityOfPlace(world, nearId) : '';""",
"""  __myCity = nearId ? (() => {
    const seg = String(world?.places?.[nearId]?.name || '').split('·')[0];
    return /府$|州$|县$/.test(seg) ? seg : '临江府';
  })() : '';""", 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('③ 语义同城优先')
