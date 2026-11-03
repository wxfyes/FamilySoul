import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
new = (
    "    // 问到府里的人：引擎先把事实顶在最前面，模型再编也编不过这一行\n"
    "    try {\n"
    "      const wHouse = loadState(this.dataDir);\n"
    "      const saidH = String(say || '');\n"
    "      const houseActor = Object.values(wHouse.actors || {}).find((a) => {\n"
    "        if (!a || a.dead || a.id === 'husband') return false;\n"
    "        if (!(a.household || ['waner', 'yunnia', 'xiaocui'].includes(a.id))) return false;\n"
    "        const short = a.name && a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
    "        return a.name && (saidH.includes(a.name) || (short && saidH.includes(short)));\n"
    "      });\n"
    "      if (houseActor) {\n"
    "        const whereH = String(wHouse.places?.[houseActor.location]?.name || '宅中');\n"
    "        const factLine = `【府中】${houseActor.name}是${houseActor.role || '府里人'}，就住「${whereH}」。`;\n"
    "        const roleOk = new RegExp(String(houseActor.role || '府里人').slice(0, 2)).test(String(reply || ''));\n"
    "        if (!roleOk) {\n"
    "          reply = `${factLine}\\n${String(reply || '').trim()}`.trim();\n"
    "          console.log(`[Scene] 先给事实：${houseActor.name}·${houseActor.role || ''}`);\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
)
if old in s and '先给事实' not in s:
    s = s.replace(old, new, 1)
    print('patched: prepend household fact')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
