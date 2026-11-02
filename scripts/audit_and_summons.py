import io

# ① 台词自检：别把"知府/到府/是府"当府名
p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  const cityNames = Object.keys(world.cities || {});\n"
    "  for (const c of new Set(text.match(/([一-龥]{2}府)/g) || [])) {\n"
    "    if (!cityNames.includes(c)) {\n"
    "      issues.push({ kind: 'reply', level: 'warn', text: `她提到了「${c}」，疆域里没有这座府` });\n"
    "    }\n"
    "  }"
)
new = (
    "  const cityNames = Object.keys(world.cities || {});\n"
    "  const BAD_WORDS = /(知|到|是|了|回|去|本|该|官|县|州|王|李|张|刘|陈|这|那|一|两|三)/;\n"
    "  // 只在\"去/往/到/在/回/至 + X府\"这种明确说法里查，且排除官名与虚词\n"
    "  for (const m of text.matchAll(/(?:去|往|到|在|回|至)([一-龥]{2}府)/g)) {\n"
    "    const c = m[1];\n"
    "    if (cityNames.includes(c)) continue;\n"
    "    if (BAD_WORDS.test(c)) continue;\n"
    "    issues.push({ kind: 'reply', level: 'warn', text: `她提到了「${c}」，疆域里没有这座府` });\n"
    "  }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: smarter city-name audit')
else:
    print('WARN: city audit block not found')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 报官 → 先传唤，再开审
p2 = 'src/world/dispatch.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

old2 = "          claim, witnesses, status: 'filed', verdict: null,"
new2 = "          claim, witnesses, status: 'summoned', hearDay: (Number(world.clock.day) || 1) + 1, hearHour: 9, verdict: null,"
if old2 in s2:
    s2 = s2.replace(old2, new2, 1)
    print('patched: report sets hearing day')
else:
    print('WARN: case creation not found')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
