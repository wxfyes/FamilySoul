import io

p = 'src/world/ritual.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "    if (trust < 55 || grievance >= 30) {\n"
)
new = (
    "    // 三档：很生分才拒绝；中间是半推半就；很亲近才完全放开\n"
    "    if (trust < 25 || grievance >= 40) {\n"
)
if old in s:
    s = s.replace(old, new)
    print('patched: refuse only when very distant')

# 中间档：解禁但 tone 按信任给，并标明"半推半就"
old2 = (
    "  if (hit.unlock) {\n"
    "    actor.intimacy.ritual = 'unlocked';\n"
    "    actor.intimacy.tone = 3;"
)
new2 = (
    "  if (hit.unlock) {\n"
    "    const relU = actor.relations?.husband || {};\n"
    "    const tU = Number(relU.trust ?? 30);\n"
    "    actor.intimacy.ritual = 'unlocked';\n"
    "    actor.intimacy.tone = tU >= 70 ? 3 : tU >= 45 ? 2 : 1; // 越亲近越放得开\n"
    "    actor.intimacy.willing = tU >= 70 ? 'eager' : tU >= 45 ? 'half' : 'reluctant';"
)
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: tone tiers by trust')

# 拒绝阈值回执文案同步
s = s.replace(
    "        reason: `${actor.name}不愿意（信任 ${Math.round(trust)}，怨怼 ${Math.round(grievance)}）`,",
    "        reason: `${actor.name}不愿意（信任 ${Math.round(trust)}，怨怼 ${Math.round(grievance)}）——太生分了`,",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
