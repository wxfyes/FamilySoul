import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 收紧旧事判定：只认提到在场者本人的记忆
old = (
    "        const poolR = (wR.memories || []).filter((m) => {\n"
    "          const t = String(m?.text || '');\n"
    "          return namesR.some((n) => t.includes(n)) || t.includes('相公') || m.visible === 'public';\n"
    "        });"
)
new = (
    "        const poolR = namesR.length\n"
    "          ? (wR.memories || []).filter((m) => {\n"
    "            const t = String(m?.text || '');\n"
    "            return namesR.some((n) => t.includes(n)) || m.visible === 'public';\n"
    "          })\n"
    "          : (wR.memories || []).filter((m) => m.visible === 'public');"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: strict memory pool for rewrite')

old2 = (
    "        const poolPH = (wPH.memories || []).filter((m) => {\n"
    "          const t = String(m?.text || '');\n"
    "          return namesPH.some((n) => t.includes(n)) || t.includes('相公') || m.visible === 'public';\n"
    "        });"
)
new2 = (
    "        const poolPH = namesPH.length\n"
    "          ? (wPH.memories || []).filter((m) => {\n"
    "            const t = String(m?.text || '');\n"
    "            return namesPH.some((n) => t.includes(n)) || m.visible === 'public';\n"
    "          })\n"
    "          : (wPH.memories || []).filter((m) => m.visible === 'public');"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: strict memory hint pool')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
