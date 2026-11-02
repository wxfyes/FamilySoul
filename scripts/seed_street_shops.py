import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 街市铺子（挂在青石板长街）
old = "    husband_room: { name: '正房', exits: ['tea_house', 'backyard'], owner: 'husband' },"
new = (
    "    husband_room: { name: '正房', exits: ['tea_house', 'backyard'], owner: 'husband' },\n"
    "    // ── 街市：一条街该有的铺子 ──\n"
    "    brothel: { name: '万花楼', exits: ['street'], owner: 'suyingxue', kind: '青楼' },\n"
    "    casino: { name: '聚宝赌坊', exits: ['street'], owner: 'zhaoxing', kind: '赌坊' },\n"
    "    inn: { name: '临江客栈', exits: ['street'], owner: 'sunjin', kind: '客栈' },\n"
    "    candy_shop: { name: '甜记糖铺', exits: ['street'], owner: 'tangpo', kind: '糖铺' },\n"
    "    cloth_shop: { name: '锦绣衣庄', exits: ['street'], owner: 'jinniang', kind: '衣铺' },\n"
    "    rice_shop: { name: '恒丰米行', exits: ['street'], owner: 'milaoban', kind: '米铺' },\n"
    "    smithy: { name: '周家铁铺', exits: ['street'], owner: 'zhoutie', kind: '铁匠铺' },\n"
    "    pawnshop: { name: '永昌当', exits: ['street'], owner: 'danglaoban', kind: '当铺' },\n"
    "    noodle_stall: { name: '王婆面摊', exits: ['street'], owner: 'wangpo', kind: '面摊' },\n"
    "    butcher: { name: '张屠户肉铺', exits: ['street'], owner: 'zhangtu', kind: '肉铺' },\n"
    "    pharmacy: { name: '回春堂药铺', exits: ['street'], owner: 'chenlangzhong', kind: '药铺' },\n"
    "    teahouse_shop: { name: '临江茶坊', exits: ['street', 'backyard', 'husband_room'], owner: 'husband' },"
)
if old in s and 'brothel:' not in s:
    s = s.replace(old, new, 1)
    print('seeded street shops')

# ② 街市上的人（每家一个当家的）
anchor = "    husband: {"
shop_actors = (
    "    suyingxue: { id: 'suyingxue', name: '苏映雪', role: '万花楼老鸨', gender: 'female', home: 'brothel', location: 'brothel', relations: { husband: { trust: 35, desire: 20, fear: 10, grievance: 0 } }, schedule: [{ at: 14, do: '在楼上招呼客人', place: 'brothel' }, { at: 2, do: '收档算账', place: 'brothel' }] },\n"
    "    zhaoxing: { id: 'zhaoxing', name: '赵兴', role: '聚宝赌坊东家', gender: 'male', home: 'casino', location: 'casino', relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 12, do: '坐庄', place: 'casino' }] },\n"
    "    sunjin: { id: 'sunjin', name: '孙进', role: '临江客栈掌柜', gender: 'male', home: 'inn', location: 'inn', relations: { husband: { trust: 32, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 6, do: '开门迎客', place: 'inn' }] },\n"
    "    tangpo: { id: 'tangpo', name: '唐婆', role: '甜记糖铺', gender: 'female', home: 'candy_shop', location: 'candy_shop', relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 7, do: '熬糖', place: 'candy_shop' }] },\n"
    "    jinniang: { id: 'jinniang', name: '锦娘', role: '锦绣衣庄掌柜', gender: 'female', home: 'cloth_shop', location: 'cloth_shop', relations: { husband: { trust: 34, desire: 15, fear: 0, grievance: 0 } }, schedule: [{ at: 8, do: '裁衣量体', place: 'cloth_shop' }] },\n"
    "    milaoban: { id: 'milaoban', name: '米老板', role: '恒丰米行', gender: 'male', home: 'rice_shop', location: 'rice_shop', relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 6, do: '看仓', place: 'rice_shop' }] },\n"
    "    zhoutie: { id: 'zhoutie', name: '周铁', role: '铁匠', gender: 'male', home: 'smithy', location: 'smithy', relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 7, do: '打铁', place: 'smithy' }] },\n"
    "    danglaoban: { id: 'danglaoban', name: '当铺老板', role: '永昌当', gender: 'male', home: 'pawnshop', location: 'pawnshop', relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 9, do: '验当', place: 'pawnshop' }] },\n"
    "    wangpo: { id: 'wangpo', name: '王婆', role: '面摊', gender: 'female', home: 'noodle_stall', location: 'noodle_stall', relations: { husband: { trust: 33, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 5, do: '下面', place: 'noodle_stall' }] },\n"
    "    zhangtu: { id: 'zhangtu', name: '张屠户', role: '肉铺', gender: 'male', home: 'butcher', location: 'butcher', relations: { husband: { trust: 26, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 5, do: '开案', place: 'butcher' }] },\n"
    "    chenlangzhong: { id: 'chenlangzhong', name: '陈郎中', role: '回春堂郎中', gender: 'male', home: 'pharmacy', location: 'pharmacy', relations: { husband: { trust: 35, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 8, do: '坐堂问诊', place: 'pharmacy' }] },\n"
)
if anchor in s and 'suyingxue' not in s:
    s = s.replace(anchor, shop_actors + anchor, 1)
    print('seeded shop keepers')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
