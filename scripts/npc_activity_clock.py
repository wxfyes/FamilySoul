import io

# ① clock：NPC 到点就记下"正在做什么"
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        actor.location = slot.place;"
new = (
    "        actor.location = slot.place;\n"
    "        actor.activity = { text: String(slot.do || ''), at: world.clock.hour, day: world.clock.day };"
)
if old in s and 'actor.activity =' not in s:
    s = s.replace(old, new, 1)
    print('patched: record activity on move')
else:
    print('WARN: schedule move not found')

# 同一时刻没换地方，也要更新"在做什么"
old2 = "      if (slot.at === world.clock.hour && slot.place && actor.location !== slot.place) {"
new2 = "      if (slot.at === world.clock.hour && slot.place) {\n        actor.activity = { text: String(slot.do || ''), at: world.clock.hour, day: world.clock.day };\n        if (actor.location === slot.place) continue;"
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: activity even without moving')
else:
    print('WARN: schedule condition not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
