import io

# ① 服务端：默认只回"相关的人"，搜索/all 才回全部
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "      const q = String(url.searchParams.get('q') || '').trim();"
)
new = (
    "      const q = String(url.searchParams.get('q') || '').trim();\n"
    "      const all = String(url.searchParams.get('all') || '') === '1';"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: read all flag')

old2 = (
    "      const rows = Object.values(world.actors || {})\n"
    "        .filter((a) => a && !a.dead && a.id !== actorId && a.id !== 'husband')\n"
    "        .filter((a) => (q ? String(a.name || '').includes(q) || String(a.role || '').includes(q) : true))\n"
)
new2 = (
    "      const cfg = getFamilyProfiles();\n"
    "      const humanActors = new Set(Object.values(cfg || {}).map((x) => x?.actor).filter(Boolean));\n"
    "      const rows = Object.values(world.actors || {})\n"
    "        .filter((a) => a && !a.dead && a.id !== actorId && a.id !== 'husband')\n"
    "        .filter((a) => {\n"
    "          if (q) return String(a.name || '').includes(q) || String(a.role || '').includes(q);\n"
    "          if (all) return true;\n"
    "          const rel = a.relations?.husband || {};\n"
    "          const here = a.location && me?.location && a.location === me.location;\n"
    "          const close = (Number(rel.trust) || 0) >= 20 || (Number(rel.grievance) || 0) >= 10;\n"
    "          return here || close || humanActors.has(a.id);\n"
    "        })\n"
)
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: related-only default')
else:
    print('WARN: rows filter not found')

# 标记是否真人
s = s.replace(
    "          trust: Number(a.relations?.husband?.trust) || 0,",
    "          trust: Number(a.relations?.husband?.trust) || 0,\n          human: humanActors.has(a.id),",
)

io.open(p, 'w', encoding='utf-8').write(s)

# ② App：默认只显示相关的，提示可搜索
p2 = 'mobile/lib/views/my_world_screen.dart'
s2 = io.open(p2, encoding='utf-8-sig').read()
s2 = s2.replace(
    "                      hintText: '搜名字或身份',",
    "                      hintText: '搜名字或身份（默认只显示相识的人）',",
)
s2 = s2.replace(
    "                          '${w['name']}  ${w['role'] ?? ''}',",
    "                          '${w['name']}  ${w['role'] ?? ''}${w['human'] == true ? '  · 真人' : ''}',",
)
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
