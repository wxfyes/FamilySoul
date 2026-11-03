import io

# ① /api/me 带上年龄 / 家中有孕 / 家中人数
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        decrees: (world.court?.decisions || []).slice(-3).map((d) => ({ day: d.day, text: d.text })),"
new = (
    "        decrees: (world.court?.decisions || []).slice(-3).map((d) => ({ day: d.day, text: d.text })),\n"
    "        life: (() => {\n"
    "          const meL = actorId ? world.actors?.[actorId] : world.actors?.husband;\n"
    "          const house = Object.values(world.actors || {}).filter(\n"
    "            (a) => a && !a.dead && a.id !== 'husband' && (a.household || (meL?.home && a.home === meL.home)),\n"
    "          );\n"
    "          return {\n"
    "            age: Number(meL?.age) || null,\n"
    "            pregnant: Boolean(meL?.pregnancy && !meL.pregnancy.born),\n"
    "            pregnancyDays: Number(meL?.pregnancy?.days) || 0,\n"
    "            house: house.slice(0, 12).map((a) => ({\n"
    "              name: a.name, role: a.role || '', age: Number(a.age) || null,\n"
    "              pregnant: Boolean(a.pregnancy && !a.pregnancy.born),\n"
    "              days: Number(a.pregnancy?.days) || 0,\n"
    "            })),\n"
    "          };\n"
    "        })(),"
)
if old in s and 'life: (() => {' not in s:
    s = s.replace(old, new, 1)
    print('added life data to /api/me')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
