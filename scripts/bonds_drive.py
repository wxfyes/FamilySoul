import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 案情生成：把池子里的人的关系也交给天道（可以照着关系编案）
old = "        `城中可涉案的人：${pool.join('、')}。`,"
new = (
    "        `城中可涉案的人：${pool.join('、')}。`,\n"
    "        (() => {\n"
    "          const rel = [];\n"
    "          const list = Object.values(w.actors || {}).filter((a) => a && pool.some((p) => p.startsWith(a.name)));\n"
    "          for (let i = 0; i < list.length; i += 1) {\n"
    "            for (let j = i + 1; j < list.length; j += 1) {\n"
    "              const b = w.bonds?.[list[i].id]?.[list[j].id];\n"
    "              if (b) rel.push(`${list[i].name}与${list[j].name}是${b.type}`);\n"
    "            }\n"
    "          }\n"
    "          return rel.length ? `他们之间的关系：${rel.slice(0, 6).join('；')}。` : '';\n"
    "        })(),\n"
    "        '案子要跟他们的关系有关（亲人反目、邻里争产、同行下黑手），别编无关的。',"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: case prompt uses bonds')

# ② 判决时：亲近的人会替他叫屈（怨怼上升）
old2 = "      saveState(DATA_DIR, w3);\n      console.log(`[Court] 判案"
new2 = (
    "      // 亲近的人替他叫屈\n"
    "      try {\n"
    "        const culpritId = cc.againstId;\n"
    "        const near = Object.entries(w3.bonds?.[culpritId] || {}).filter(([, b]) => b && b.score >= 30);\n"
    "        for (const [otherId] of near) {\n"
    "          const other = w3.actors?.[otherId];\n"
    "          if (!other || other.dead) continue;\n"
    "          other.relations = other.relations || {};\n"
    "          const rel = other.relations.husband || { trust: 30, desire: 0, fear: 0, grievance: 0 };\n"
    "          rel.grievance = Math.min(100, (Number(rel.grievance) || 0) + 4);\n"
    "          other.relations.husband = rel;\n"
    "          console.log(`[Court] ${other.name}替${w3.actors[culpritId]?.name}叫屈（怨怼+4）`);\n"
    "        }\n"
    "      } catch { /* 忽略 */ }\n\n"
    "      saveState(DATA_DIR, w3);\n      console.log(`[Court] 判案"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: kin grievance on verdict')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
