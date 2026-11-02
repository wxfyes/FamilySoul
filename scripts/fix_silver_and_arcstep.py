import io

# ① App：现银对所有人都显示（之前只给相公）
p = 'mobile/lib/views/my_world_screen.dart'
s = io.open(p, encoding='utf-8-sig').read()
old = "            if (self['isHusband'] == true)\n              _kv('现银', '${_num(assets['silver'], digits: 2)} 两'),"
new = "            _kv('现银', '${_num(assets['silver'], digits: 2)} 两'),"
if old in s:
    s = s.replace(old, new)
    print('patched: show silver for everyone')
else:
    print('WARN: silver conditional not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 服务端 /api/me：难关的"眼下"用 arcStepText 兜底
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
s2 = s2.replace(
    "import { ARC_HINT } from './world/arcs.js';",
    "import { ARC_HINT, arcStepText } from './world/arcs.js';",
)
old2 = (
    "              step: (() => {\n"
    "                try {\n"
    "                  const steps = (arc.log || []).map((l) => l.text);\n"
    "                  return steps.length ? steps[steps.length - 1] : '';\n"
    "                } catch {\n"
    "                  return '';\n"
    "                }\n"
    "              })(),"
)
new2 = "              step: (() => {\n                try {\n                  return arcStepText(actorId, arc);\n                } catch {\n                  return '';\n                }\n              })(),"
if old2 in s2:
    s2 = s2.replace(old2, new2)
    print('patched: /api/me arc step fallback')
else:
    print('WARN: arc step block not found in server')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
