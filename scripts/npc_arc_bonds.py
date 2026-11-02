import io

p = 'src/world/arcs.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    `他对相公：信任${rel.trust ?? 30}、怨怼${rel.grievance ?? 0}。`,"
new = (
    "    `他对相公：信任${rel.trust ?? 30}、怨怼${rel.grievance ?? 0}。`,\n"
    "    (() => {\n"
    "      const mine = world.bonds?.[actorId] || {};\n"
    "      const close = Object.entries(mine).filter(([, b]) => b && b.score >= 25)\n"
    "        .map(([id, b]) => `${world.actors?.[id]?.name}（${b.type}）`).slice(0, 3);\n"
    "      const foes = Object.entries(mine).filter(([, b]) => b && b.score <= -10)\n"
    "        .map(([id, b]) => `${world.actors?.[id]?.name}（${b.type}）`).slice(0, 2);\n"
    "      const parts = [];\n"
    "      if (close.length) parts.push(`亲近的人：${close.join('、')}`);\n"
    "      if (foes.length) parts.push(`不对付的人：${foes.join('、')}`);\n"
    "      return parts.length ? `${parts.join('；')}。他的事可以跟这些人有关。` : '';\n"
    "    })(),"
)
if old in s and '亲近的人：' not in s:
    s = s.replace(old, new, 1)
    print('patched: npc arc prompt includes bonds')
else:
    print('WARN: arc prompt line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
