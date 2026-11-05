import io

# ① 公共函数：谁看得见哪些产业
p = 'src/world/employment.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function visiblePropertiesOf' not in s:
    s = s.rstrip() + '''

/**
 * 谁看得见哪些产业（唯一出处）。
 * 相公：自己名下、自己管的、以及无主的老铺；
 * 其他人：只看得见自己名下或自己管的。
 */
export function visiblePropertiesOf(world, actorId) {
  const props = Array.isArray(world?.assets?.properties) ? world.assets.properties : [];
  const id = actorId || 'husband';
  return props.filter((p) => {
    if (!p) return false;
    if (id === 'husband') {
      return p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper);
    }
    return p.owner === id || p.keeper === id;
  });
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① visiblePropertiesOf 加入 employment.js')

# ② server：两处改调公共函数
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'visiblePropertiesOf' not in t:
    # 引入
    if "from './world/employment.js'" in t:
        t = t.replace("import { hireStaff } from './world/employment.js';",
                      "import { hireStaff, visiblePropertiesOf } from './world/employment.js';")
    else:
        # 找到任意 world/ 引入行后插入
        first = t.find("\nimport ")
        t = t[:first+1] + "import { visiblePropertiesOf } from './world/employment.js';\n" + t[first+1:]
    print('② server 引入公共函数')

old1 = """        const props = (world.assets?.properties || [])
          .filter((x) => {
            if (!x) return false;
            if (actorId === 'husband') return x.owner === 'husband' || x.keeper === 'husband' || (!x.owner && !x.keeper);
            return x.owner === actorId || x.keeper === actorId;
          })
          .map((x) => ({ name: x.name, income: x.incomePerDay || 0 }));"""
new1 = """        const props = visiblePropertiesOf(world, actorId)
          .map((x) => ({ name: x.name, income: x.incomePerDay || 0 }));"""
if old1 in t:
    t = t.replace(old1, new1, 1)
    print('③ menu 改调公共函数')

old2 = """      const props = (world.assets?.properties || []).filter((p) => {
        if (!p) return false;
        if (isHusband) {
          return p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper);
        }
        return p.keeper === actorId || p.owner === actorId;
      });"""
new2 = """      const props = visiblePropertiesOf(world, actorId || 'husband');"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('④ /api/me 改调公共函数')

io.open(p2, 'w', encoding='utf-8-sig').write(t)
