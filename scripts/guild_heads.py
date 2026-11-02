import io

# ① 补漕帮帮主雷七
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      county_magistrate: {"
add = (
    "      leiqi: { id: 'leiqi', name: '雷七', role: '漕帮帮主', gender: 'male', home: 'dock', location: 'dock', goals: ['码头只归漕帮说话'], secret: '他与县衙书吏有旧账往来', relations: { husband: { trust: 25, desire: 0, fear: 0, grievance: 5 } }, schedule: [{ at: 7, do: '在码头点船', place: 'dock' }] },\n"
)
if anchor in s and 'leiqi:' not in s:
    s = s.replace(anchor, add + anchor, 1)
    print('seeded leiqi')

# ② 行会改成"按名字找会首"，避免 id 漂移
s = s.replace("head: 'leiq i'", "head: '', headName: '雷七'")
s = s.replace("head: 'suniang'", "head: '', headName: '苏娘'")
s = s.replace("head: 'qiantonghai'", "head: 'qiantonghai', headName: '钱通海'")
s = s.replace("head: 'zhangtu'", "head: 'zhangtu', headName: '张屠户'")
s = s.replace("head: 'danglaoban'", "head: 'danglaoban', headName: '曹当'")

io.open(p, 'w', encoding='utf-8').write(s)

# ③ clock：解析会首（id 或名字）
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

old = "    const head = world.actors?.[g.head];"
new = (
    "    let head = world.actors?.[g.head];\n"
    "    if (!head && g.headName) {\n"
    "      head = Object.values(world.actors || {}).find((a) => a && a.name === g.headName);\n"
    "      if (head) g.head = head.id;\n"
    "    }"
)
if old in s2:
    s2 = s2.replace(old, new, 1)
    print('patched: resolve guild head by name')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
