import io

# ① 书院与先生
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    husband_room: { name: '正房', exits: ['tea_house', 'backyard'], owner: 'husband' },"
new = (
    "    husband_room: { name: '正房', exits: ['tea_house', 'backyard'], owner: 'husband' },\n"
    "    academy: { name: '临江书院', exits: ['street'], owner: 'court', kind: '书院' },\n"
    "    temple: { name: '城隍庙', exits: ['street'], owner: 'court', kind: '庙' },"
)
if old in s and 'academy:' not in s:
    s = s.replace(old, new, 1)
    print('seeded academy and temple')

anchor = "      leiqi: { id: 'leiqi',"
add = (
    "      shuyuan: { id: 'shuyuan', name: '老夫子', role: '书院先生', gender: 'male', home: 'academy', location: 'academy', goals: ['教出几个中举的'], relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 7, do: '讲学', place: 'academy' }, { at: 16, do: '批课业', place: 'academy' }] },\n"
    "      monk: { id: 'monk', name: '慧明和尚', role: '城隍庙住持', gender: 'male', home: 'temple', location: 'temple', goals: ['香火不断'], relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 5, do: '早课', place: 'temple' }] },\n"
)
if anchor in s and 'shuyuan:' not in s:
    s = s.replace(anchor, add + anchor, 1)
    print('seeded teacher and monk')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
