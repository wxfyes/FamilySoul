import io

# ① 记忆带上"关于谁 / 给谁看"
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

import re
m = re.search(r"world\.memories\.push\(\{(.*?)\}\);", s, re.S)
if not m:
    print('WARN: memories.push not found')
else:
    old = m.group(0)
    if 'visible' not in old:
        new = ("world.memories.push({\n"
               "          text: String(args.text || '').slice(0, 120),\n"
               "          day: world.clock.day,\n"
               "          at: Date.now(),\n"
               "          about: String(args.about || args.who || '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean),\n"
               "          visible: String(args.visible || 'private'),\n"
               "        });")
        s = s.replace(old, new, 1)
        print('patched: memory about/visible')
    else:
        print('already has visible')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 代演取记忆：按可见范围过滤
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old2 = (
    "            const hisMem = (wPost.memories || []).map((m) => String(m?.text || ''))\n"
    "              .filter((t) => t.includes('王甯') || t.includes(husPost?.name || '') || (herName && t.includes(herName))\n"
    "                || /(相公|雅阁|相好|留门|答应了)/.test(t))\n"
    "              .slice(-12);"
)
new2 = (
    "            const myId = this._viewerActorId;\n"
    "            const hisMem = (wPost.memories || [])\n"
    "              .filter((m) => {\n"
    "                const about = Array.isArray(m?.about) ? m.about : [];\n"
    "                if (m?.visible === 'public') return true;\n"
    "                if (about.length === 0) return false; // 没写主人的，默认不给外人看\n"
    "                return about.includes(myId) || about.includes('husband') || about.includes('紫嫣');\n"
    "              })\n"
    "              .map((m) => String(m?.text || ''))\n"
    "              .slice(-12);"
)
if old2 in s2:
    s2 = s2.replace(old2, new2)
    print('patched: proxy memory visibility')
else:
    print('WARN: hisMem filter not found')

# ③ 他自己账号里的对话，也只挑跟她有关的（已有），保留
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
