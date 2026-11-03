import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "            saveState(this.dataDir, wr);\n"
    "            console.log(`[Ritual] 关系结算：${who.name} 欲望+8→${rel.desire} 信任+5→${rel.trust}（已标为相好）`);"
)
new = (
    "            // 会不会怀上：看身子、年龄、缘分（不是每次都中）\n"
    "            try {\n"
    "              const age = Number(who.age) || 22;\n"
    "              const fertile = who.gender !== 'male' && age >= 16 && age <= 42;\n"
    "              const already = Boolean(who.pregnancy && !who.pregnancy.born);\n"
    "              if (fertile && !already) {\n"
    "                const chance = age <= 30 ? 0.55 : 0.35;\n"
    "                if (Math.random() < chance) {\n"
    "                  who.pregnancy = { days: 0, father: 'husband', sinceDay: wr.clock?.day || 1, born: false };\n"
    "                  wr.memories = Array.isArray(wr.memories) ? wr.memories : [];\n"
    "                  wr.memories.push({ text: `${who.name}有了身孕`, day: wr.clock?.day || 1, at: Date.now(), about: [who.id, 'husband'], visible: 'private' });\n"
    "                  console.log(`[Ritual] ${who.name}有喜了（${age}岁）`);\n"
    "                } else {\n"
    "                  console.log(`[Ritual] ${who.name}这次没中`);\n"
    "                }\n"
    "              }\n"
    "            } catch { /* 忽略 */ }\n"
    "            saveState(this.dataDir, wr);\n"
    "            console.log(`[Ritual] 关系结算：${who.name} 欲望+8→${rel.desire} 信任+5→${rel.trust}（已标为相好）`);"
)
if old in s and '有喜了' not in s:
    s = s.replace(old, new, 1)
    print('patched: pregnancy chance after ritual')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
