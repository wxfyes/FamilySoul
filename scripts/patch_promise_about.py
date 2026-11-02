import io

# ① 承诺带 about：以后按人名清得掉
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
import re
m = re.search(r"world\.promises\.push\(\{(.*?)\}\);", s, re.S)
if m and 'about' not in m.group(0):
    old = m.group(0)
    new = ("world.promises.push({\n"
           "          text: String(args.text || '').slice(0, 80),\n"
           "          due: due,\n"
           "          at: world.clock.day,\n"
           "          done: false,\n"
           "          about: String(args.who || args.about || '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean),\n"
           "        });")
    s = s.replace(old, new, 1)
    print('patched: promise carries about')
else:
    print('promise already has about or not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 抹除时也按 about 清
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old2 = (
    "            world.promises = (world.promises || []).filter((pr) => {\n"
    "              const t = String(pr?.text || '');\n"
    "              return !(t.includes(a.name) || (nameShort && t.includes(nameShort)));\n"
    "            });"
)
new2 = (
    "            world.promises = (world.promises || []).filter((pr) => {\n"
    "              const t = String(pr?.text || '');\n"
    "              const about = Array.isArray(pr?.about) ? pr.about : [];\n"
    "              if (about.includes(id)) return false;\n"
    "              return !(t.includes(a.name) || (nameShort && t.includes(nameShort)));\n"
    "            });"
)
if old2 in s2:
    s2 = s2.replace(old2, new2)
    print('patched: wipe by about too')
else:
    print('WARN: wipe promise filter not found')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
