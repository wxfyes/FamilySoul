import io

# ① 每城补一个知县（在知府下面）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    const govPlace = ensureGovPlace(world, cityName);"
new = (
    "    const govPlace = ensureGovPlace(world, cityName);\n"
    "    // 每城再补一个知县：知府管一府，知县管一县\n"
    "    const countyId = `county_${cityName}`;\n"
    "    if (!world.actors[countyId]) {\n"
    "      const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '周', '吴', '徐'];\n"
    "      const sn = SURNAMES[Math.abs(cityName.length + cityName.charCodeAt(0)) % SURNAMES.length];\n"
    "      world.actors[countyId] = {\n"
    "        id: countyId, name: `${sn}知县`, role: `${cityName}知县`, gender: 'male',\n"
    "        home: govPlace, location: govPlace, origin: 'preset',\n"
    "        goals: ['三年考满'], relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } },\n"
    "        schedule: [{ at: 9, do: '升堂理事', place: govPlace }],\n"
    "      };\n"
    "    }"
)
if old in s and 'county_' not in s:
    s = s.replace(old, new, 1)
    print('seeded county magistrates')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
