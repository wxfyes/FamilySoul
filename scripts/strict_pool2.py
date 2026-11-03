import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const poolR = namesR.length\n"
    "          ? (wR.memories || []).filter((m) => {\n"
    "            const t = String(m?.text || '');\n"
    "            return namesR.some((n) => t.includes(n)) || m.visible === 'public';\n"
    "          })\n"
    "          : (wR.memories || []).filter((m) => m.visible === 'public');"
)
new = (
    "        const idsR = hereR.map((a) => a.id);\n"
    "        const poolR = (wR.memories || []).filter((m) => {\n"
    "          const t = String(m?.text || '');\n"
    "          const about = Array.isArray(m?.about) ? m.about : [];\n"
    "          // 只认\"关于她本人\"的记忆；公开传闻不算她知道的事\n"
    "          return about.some((id) => idsR.includes(id)) || namesR.some((n) => t.includes(n));\n"
    "        });"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: strict pool for rewrite')

old2 = (
    "        const poolPH = namesPH.length\n"
    "          ? (wPH.memories || []).filter((m) => {\n"
    "            const t = String(m?.text || '');\n"
    "            return namesPH.some((n) => t.includes(n)) || m.visible === 'public';\n"
    "          })\n"
    "          : (wPH.memories || []).filter((m) => m.visible === 'public');"
)
new2 = (
    "        const idsPH = herePH.map((a) => a.id);\n"
    "        const poolPH = (wPH.memories || []).filter((m) => {\n"
    "          const t = String(m?.text || '');\n"
    "          const about = Array.isArray(m?.about) ? m.about : [];\n"
    "          return about.some((id) => idsPH.includes(id)) || namesPH.some((n) => t.includes(n));\n"
    "        });"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: strict pool for hint')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
