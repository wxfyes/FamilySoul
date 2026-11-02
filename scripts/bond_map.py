import io

# ① 关系网数据
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'bondEdges' not in s:
    old = "        npcArcs: Object.entries(world.npcArcs || {})"
    new = (
        "        bondEdges: (() => {\n"
        "          const seen = new Set();\n"
        "          const out = [];\n"
        "          for (const [a, m] of Object.entries(world.bonds || {})) {\n"
        "            for (const [b, v] of Object.entries(m || {})) {\n"
        "              const key = a < b ? `${a}|${b}` : `${b}|${a}`;\n"
        "              if (seen.has(key)) continue;\n"
        "              seen.add(key);\n"
        "              out.push({ a: world.actors?.[a]?.name || a, b: world.actors?.[b]?.name || b, type: v.type, score: v.score });\n"
        "            }\n"
        "          }\n"
        "          return out.slice(0, 80);\n"
        "        })(),\n"
        "        npcArcs: Object.entries(world.npcArcs || {})"
    )
    if old in s:
        s = s.replace(old, new, 1)
        print('added bondEdges payload')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 看板卡片 + 环形图
p2 = 'web/dashboard.html'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'id="bondmap"' not in s2:
    anchor = "  <section class=\"card\">\n    <h2>街面风评</h2>"
    card = (
        "  <section class=\"card full\">\n"
        "    <h2>关系网（谁跟谁一伙，谁跟谁有仇）</h2>\n"
        "    <div id=\"bondmap\" style=\"margin-top:6px;overflow:auto\">—</div>\n"
        "  </section>\n\n"
        "  <section class=\"card\">\n    <h2>街面风评</h2>"
    )
    if anchor in s2:
        s2 = s2.replace(anchor, card, 1)
        print('added bondmap card')

if 'function renderBondMap' not in s2:
    fn = (
        "function renderBondMap(w) {\n"
        "  const el = $('bondmap');\n"
        "  if (!el) return;\n"
        "  const edges = w.bondEdges || [];\n"
        "  if (!edges.length) { el.innerHTML = '<div class=\"muted\">还没有关系</div>'; return; }\n"
        "  const names = Array.from(new Set(edges.flatMap((e) => [e.a, e.b]))).slice(0, 24);\n"
        "  const n = names.length;\n"
        "  const R = 220, cx = 300, cy = 230;\n"
        "  const pos = {};\n"
        "  names.forEach((nm, i) => {\n"
        "    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;\n"
        "    pos[nm] = [cx + R * Math.cos(ang), cy + R * Math.sin(ang)];\n"
        "  });\n"
        "  const lines = edges.filter((e) => pos[e.a] && pos[e.b]).map((e) => {\n"
        "    const [x1, y1] = pos[e.a];\n"
        "    const [x2, y2] = pos[e.b];\n"
        "    const color = e.score >= 25 ? '#7BD88F' : e.score <= -10 ? '#e05a5a' : '#4a5568';\n"
        "    const wd = Math.min(4, 1 + Math.abs(e.score) / 25);\n"
        "    return `<line x1=\"${x1}\" y1=\"${y1}\" x2=\"${x2}\" y2=\"${y2}\" stroke=\"${color}\" stroke-width=\"${wd}\" opacity=\"0.65\"><title>${e.a}—${e.b} ${e.type}(${e.score})</title></line>`;\n"
        "  }).join('');\n"
        "  const dots = names.map((nm) => {\n"
        "    const [x, y] = pos[nm];\n"
        "    return `<circle cx=\"${x}\" cy=\"${y}\" r=\"5\" fill=\"#7fb4ff\"><title>${nm}</title></circle>`\n"
        "      + `<text x=\"${x}\" y=\"${y - 9}\" font-size=\"11\" fill=\"#cfd6e4\" text-anchor=\"middle\">${nm}</text>`;\n"
        "  }).join('');\n"
        "  const legend = '<div class=\"muted\" style=\"font-size:11px;margin-top:4px\">绿＝亲近　红＝不对付　灰＝一般　（鼠标悬停看类型与分值）</div>';\n"
        "  el.innerHTML = `<svg width=\"600\" height=\"470\" viewBox=\"0 0 600 470\">${lines}${dots}</svg>${legend}`;\n"
        "}\n\n"
    )
    s2 = s2.replace("function renderWorldExtras(", fn + "function renderWorldExtras(", 1)
    print('added renderBondMap')

s2 = s2.replace(
    "renderWorldExtras(w); } catch (e) {}",
    "renderWorldExtras(w); renderBondMap(w); } catch (e) {}",
    1,
)

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
