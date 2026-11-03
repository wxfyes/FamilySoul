import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        const asked = house.find((a) => a.name && String(say || '').includes(a.name));"
new = (
    "        const saidF = String(say || '');\n"
    "        const asked = house.find((a) => {\n"
    "          if (!a.name) return false;\n"
    "          const short = a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
    "          return saidF.includes(a.name) || (short && saidF.includes(short));\n"
    "        });"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: match short name too')

# 行首换行也清掉
s = s.replace(
    "          .replace(/\\n{2,}/g, '\\n')\n          .trim();",
    "          .replace(/\\n{2,}/g, '\\n')\n          .replace(/^\\s+/, '')\n          .trim();",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
