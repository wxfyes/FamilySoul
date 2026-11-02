import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 只在"真的移动了"时，才用到场旁白
old = (
    "        // 刚换了地方：别回\"没人应声\"，直接报到场\n"
    "        if (/没人应声/.test(String(reply))) {\n"
    "          const placeNow = String(wPost.places?.[locPost]?.name || '');\n"
    "          if (placeNow) reply = `【${placeNow}】：（你到了${placeNow}。）`;\n"
    "        }"
)
new = (
    "        // 只有真的换了地方，才说\"到了\"；原地不动时不许胡说\n"
    "        const movedNow = Boolean(summonResult && ((summonResult.moved || []).length > 0 || summonResult.left));\n"
    "        if (/没人应声/.test(String(reply))) {\n"
    "          const placeNow = String(wPost.places?.[locPost]?.name || '');\n"
    "          if (movedNow && placeNow) reply = `【${placeNow}】：（你到了${placeNow}。）`;\n"
    "          else reply = `【${placeNow || '这里'}】：（没人接话。）`;\n"
    "        }"
)
if old in s:
    s = s.replace(old, new)
    print('patched: arrival only when actually moved')
else:
    print('WARN: arrival block not found')

# ② 点名在场的人，必须他应声
anchor = "        bits.push(hereNames.length ? `此刻在跟前的只有：${hereNames.join('、')}` : '此刻跟前没有别人');"
add = (
    "        bits.push(hereNames.length ? `此刻在跟前的只有：${hereNames.join('、')}` : '此刻跟前没有别人');\n"
    "        if (hereNames.length) bits.push('玩家点了谁的名字，就必须由那个人开口应声，不许沉默、不许换别人答');"
)
if anchor in s and '玩家点了谁的名字' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: named present must answer')
else:
    print('WARN: hereNames anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
