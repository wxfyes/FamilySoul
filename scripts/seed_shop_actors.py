import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      waner: {\n        id: 'waner', gender: 'female', home: 'backyard',"
shops = (
    "      suyingxue: { id: 'suyingxue', name: '苏映雪', role: '万花楼老鸨', gender: 'female', home: 'brothel', location: 'brothel', goals: ['把万花楼撑住', '寻个靠得住的贵人'], secret: '楼里有官面上的暗股', relations: { husband: { trust: 35, desire: 20, fear: 10, grievance: 0 } }, schedule: [{ at: 14, do: '在楼上招呼客人', place: 'brothel' }, { at: 2, do: '收档算账', place: 'brothel' }] },\n"
    "      zhaoxing: { id: 'zhaoxing', name: '赵兴', role: '聚宝赌坊东家', gender: 'male', home: 'casino', location: 'casino', goals: ['把赌坊开到码头'], secret: '他欠了漕帮一笔印子钱', relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 12, do: '坐庄', place: 'casino' }] },\n"
    "      sunjin: { id: 'sunjin', name: '孙进', role: '临江客栈掌柜', gender: 'male', home: 'inn', location: 'inn', goals: ['把客栈做成南来北往第一站'], relations: { husband: { trust: 32, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 6, do: '开门迎客', place: 'inn' }] },\n"
    "      tangpo: { id: 'tangpo', name: '唐婆', role: '甜记糖铺', gender: 'female', home: 'candy_shop', location: 'candy_shop', goals: ['给孙子攒钱'], relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 7, do: '熬糖', place: 'candy_shop' }] },\n"
    "      jinniang: { id: 'jinniang', name: '锦娘', role: '锦绣衣庄掌柜', gender: 'female', home: 'cloth_shop', location: 'cloth_shop', goals: ['做成城里第一衣庄'], secret: '她给官眷私下改过衣裳', relations: { husband: { trust: 34, desire: 15, fear: 0, grievance: 0 } }, schedule: [{ at: 8, do: '裁衣量体', place: 'cloth_shop' }] },\n"
    "      milaoban: { id: 'milaoban', name: '米老板', role: '恒丰米行', gender: 'male', home: 'rice_shop', location: 'rice_shop', goals: ['囤粮待价'], relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 6, do: '看仓', place: 'rice_shop' }] },\n"
    "      zhoutie: { id: 'zhoutie', name: '周铁', role: '铁匠', gender: 'male', home: 'smithy', location: 'smithy', goals: ['打出一把好刀'], relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 7, do: '打铁', place: 'smithy' }] },\n"
    "      danglaoban: { id: 'danglaoban', name: '曹当', role: '永昌当老板', gender: 'male', home: 'pawnshop', location: 'pawnshop', goals: ['收尽城中急当的好东西'], secret: '他手里压着几张来路不明的契', relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 9, do: '验当', place: 'pawnshop' }] },\n"
    "      wangpo: { id: 'wangpo', name: '王婆', role: '面摊', gender: 'female', home: 'noodle_stall', location: 'noodle_stall', goals: ['守着摊子过活'], relations: { husband: { trust: 33, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 5, do: '下面', place: 'noodle_stall' }] },\n"
    "      zhangtu: { id: 'zhangtu', name: '张屠户', role: '肉铺', gender: 'male', home: 'butcher', location: 'butcher', goals: ['多攒几亩田'], relations: { husband: { trust: 26, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 5, do: '开案', place: 'butcher' }] },\n"
    "      chenlangzhong: { id: 'chenlangzhong', name: '陈郎中', role: '回春堂郎中', gender: 'male', home: 'pharmacy', location: 'pharmacy', goals: ['把回春堂传下去'], relations: { husband: { trust: 35, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 8, do: '坐堂问诊', place: 'pharmacy' }] },\n"
)
if anchor in s and 'suyingxue: { id' not in s:
    s = s.replace(anchor, shops + anchor, 1)
    print('inserted shop keepers into actors seed')
else:
    print('WARN: actors anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
