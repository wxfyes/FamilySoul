import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const dup = buildIndex(world).has(name);\n"
    "        if (dup) continue;"
)
new = (
    "        const idx = buildIndex(world);\n"
    "        if (idx.has(name)) continue;\n"
    "        // 同一个人别再长一遍：名字互相包含（陈郎中 / 郎中）也算重复\n"
    "        const similar = Object.values(world.actors || {}).find((a) => {\n"
    "          const an = String(a?.name || '');\n"
    "          if (!an) return false;\n"
    "          return an.includes(name) || name.includes(an);\n"
    "        });\n"
    "        if (similar) {\n"
    "          applied.push(`已有此人:${similar.name}`);\n"
    "          continue;\n"
    "        }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: fuzzy dedupe on spawn')
else:
    print('WARN: dup block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
