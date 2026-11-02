import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        if (!toId || amount <= 0) continue;"
new = (
    "        if (!toId || amount <= 0) continue;\n"
    "        // 借给自己 → 直接拒绝（记账员偶尔会写 to=husband）\n"
    "        if (String(toId) === String(fromId)) {\n"
    "          applied.push('借款无效:借方与贷方相同');\n"
    "          continue;\n"
    "        }\n"
    "        // 同一天、同一对、同一数目只记一次，避免重复借贷\n"
    "        const dup = (world.promises || []).find(\n"
    "          (pr) => pr && pr.loan && !pr.done && pr.loan.from === fromId && pr.loan.to === toId\n"
    "            && Math.abs(Number(pr.loan.amount) - amount) < 0.01 && Number(pr.at) === Number(world.clock.day),\n"
    "        );\n"
    "        if (dup) {\n"
    "          applied.push('借款已记过，未重复落账');\n"
    "          continue;\n"
    "        }"
)
if old in s:
    s = s.replace(old, new)
    print('patched: reject self-loan and dedupe')
else:
    print('WARN: loan guard anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
