import io
# ① 服务端：出身更全（男女老少都能挑到像样的）
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const ROLE_MAP = {
      scholar: '求学的生员',
      merchant: '行脚小商客',
      wanderer: '初来乍到的游侠',
    };"""
new = """    const ROLE_MAP = {
      scholar: '求学的生员',
      merchant: '行脚小商客',
      wanderer: '初来乍到的游侠',
      farmer: '城郊农户',
      artisan: '手艺匠人',
      weaver: '绣坊绣娘',
      servant: '大户仆役',
      player: '戏班伶人',
      medic: '游方郎中',
      boatman: '运河船工',
      guard: '镖行趟子手',
      teacher: '私塾先生',
      clerk: '县衙书办',
      peddler: '走街货郎',
      priest: '庵堂道姑',
      hunter: '山中猎户',
      cook: '酒楼厨娘',
      singer: '茶坊唱曲',
    };"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 服务端出身 18 种')
