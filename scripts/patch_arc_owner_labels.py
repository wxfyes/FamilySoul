import io

# ① arcs.js：暴露"眼下第几步"（没有推进日志也能显示）
p = 'src/world/arcs.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function arcStepText' not in s:
    s += (
        "\n/** 当前这一步的文案：有推进日志用最后一条，没有就用种子的第一步 */\n"
        "export function arcStepText(actorId, arc) {\n"
        "  const seed = ARC_SEEDS[actorId];\n"
        "  if (!seed) return '';\n"
        "  const logs = Array.isArray(arc?.log) ? arc.log : [];\n"
        "  if (logs.length) return String(logs[logs.length - 1]?.text || '');\n"
        "  const stage = Math.min(Number(arc?.stage) || 0, seed.steps.length - 1);\n"
        "  return seed.steps[stage] || seed.steps[0] || '';\n"
        "}\n"
    )
    print('added arcStepText')
io.open(p, 'w', encoding='utf-8').write(s)

# ② member-card：难关写明"眼下在闹什么"
p2 = 'src/world/member-card.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
s2 = s2.replace(
    "import { loadState, worldDate } from './state.js';",
    "import { loadState, worldDate } from './state.js';\nimport { arcStepText } from './arcs.js';",
)
old = (
    "  const steps = (arc.log || []).map((l) => l.text);\n"
    "  const step = steps.length ? steps[steps.length - 1] : '';"
)
new = "  const step = arcStepText(actorId, arc);"
if old in s2:
    s2 = s2.replace(old, new)
    print('patched member-card arc step')
else:
    print('WARN: arc step block not found in member-card')
io.open(p2, 'w', encoding='utf-8').write(s2)

# ③ 看板承诺显示"关于谁"
p3 = 'web/dashboard.html'
s3 = io.open(p3, encoding='utf-8-sig').read()
old3 = "    title: String(p.text||''), detail: '', extra: '', raw: String(p.text||''), kindKey: 'promise',"
new3 = (
    "    title: String(p.text||''), detail: '', raw: String(p.text||''), kindKey: 'promise',\n"
    "    extra: (() => {\n"
    "      const about = Array.isArray(p.about) ? p.about : [];\n"
    "      const names = about.map((id) => ((w.actors||[]).find(a => a.id === id)?.name || id)).filter(Boolean);\n"
    "      if (names.length) return '关于 ' + names.join('、');\n"
    "      const hit = (w.actors||[]).find(a => a.id !== 'husband' && a.name && String(p.text||'').includes(a.name));\n"
    "      return hit ? '关于 ' + hit.name : '';\n"
    "    })(),"
)
if old3 in s3:
    s3 = s3.replace(old3, new3)
    print('patched dashboard promise owner')
else:
    print('WARN: promise row not found')
io.open(p3, 'w', encoding='utf-8').write(s3)
print('ok')
