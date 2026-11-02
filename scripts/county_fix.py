import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  return world.court;\n}"
add = (
    "  // 每城补知县（独立于官职是否已存在）\n"
    "  try {\n"
    "    for (const cityName of Object.keys(world.cities || {})) {\n"
    "      const countyId = `county_${cityName}`;\n"
    "      if (world.actors?.[countyId]) continue;\n"
    "      const govPlace = ensureGovPlace(world, cityName);\n"
    "      const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '周', '吴', '徐'];\n"
    "      const sn = SURNAMES[Math.abs(cityName.length + cityName.charCodeAt(0)) % SURNAMES.length];\n"
    "      world.actors = world.actors || {};\n"
    "      world.actors[countyId] = {\n"
    "        id: countyId, name: `${sn}知县`, role: `${cityName}知县`, gender: 'male',\n"
    "        home: govPlace, location: govPlace, origin: 'preset',\n"
    "        goals: ['三年考满'], relations: { husband: { trust: 28, desire: 0, fear: 0, grievance: 0 } },\n"
    "        schedule: [{ at: 9, do: '升堂理事', place: govPlace }],\n"
    "      };\n"
    "    }\n"
    "  } catch { /* 忽略 */ }\n\n"
    "  return world.court;\n}"
)
if anchor in s and 'county_${cityName}' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: ensure counties for all cities')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
