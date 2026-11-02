import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const ours =\n"
    "          (Number(mil.army) || 0) +\n"
    "          (Number(mil.militia) || 0) * 0.6 +\n"
    "          (Number(mil.guards) || 0) * 0.3 +\n"
    "          allyPower;"
)
new = (
    "        // 已经驻在那座城外的兵，也算这一战的人手\n"
    "        const stationed = Number(world.garrisons?.[cityName]) || 0;\n"
    "        if (stationed > 0) applied.push(`驻军参战:${stationed}`);\n"
    "        const ours =\n"
    "          (Number(mil.army) || 0) +\n"
    "          (Number(mil.militia) || 0) * 0.6 +\n"
    "          (Number(mil.guards) || 0) * 0.3 +\n"
    "          stationed * 0.9 +\n"
    "          allyPower;"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: garrison joins siege')

# 城破：驻军进城（变成该城驻军）；受挫：驻军折损两成
old2 = "          applied.push(`攻城:${cityName} 已下`);"
new2 = (
    "          world.garrisons = world.garrisons || {};\n"
    "          if (stationed > 0) world.garrisons[cityName] = Math.max(1, Math.round(stationed * 0.8));\n"
    "          applied.push(`攻城:${cityName} 已下`);"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: win keeps garrison')

old3 = "          applied.push(`攻城:${cityName} 未下（折损${loss}，士气-15）`);"
new3 = (
    "          if (stationed > 0) {\n"
    "            world.garrisons = world.garrisons || {};\n"
    "            world.garrisons[cityName] = Math.max(0, Math.round(stationed * 0.8));\n"
    "          }\n"
    "          applied.push(`攻城:${cityName} 未下（折损${loss}，士气-15）`);"
)
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('patched: lose garrison attrition')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
