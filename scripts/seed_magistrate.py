import io

# ① 补县令 + 仵作（临江县）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      waner: {\n        id: 'waner', gender: 'female', home: 'backyard',"
add = (
    "      county_magistrate: { id: 'county_magistrate', name: '周文达', role: '临江县令', gender: 'male', home: 'yamen', location: 'yamen', goals: ['三年考绩升迁', '把这县的案子判清楚'], secret: '他收过钱通海一份年礼', relations: { husband: { trust: 30, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 9, do: '升堂理事', place: 'yamen' }, { at: 17, do: '退堂', place: 'yamen' }] },\n"
    "      coroner: { id: 'coroner', name: '老宋', role: '仵作', gender: 'male', home: 'yamen', location: 'yamen', goals: ['少惹事'], relations: { husband: { trust: 25, desire: 0, fear: 0, grievance: 0 } }, schedule: [{ at: 8, do: '在衙里待命', place: 'yamen' }] },\n"
)
if anchor in s and 'county_magistrate' not in s:
    s = s.replace(anchor, add + anchor, 1)
    print('seeded magistrate and coroner')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
