import io, re

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("            const facts = [];")
end_marker = "            console.log('[Proxy] 事实"
end = s.find(end_marker)
if start < 0 or end < 0:
    print('WARN: facts block not found', start, end)
else:
    new_block = (
        "            const promiseFacts = [];\n"
        "            const memoryFacts = hisMem.slice(-6);\n"
        "            const apptFacts = [];\n"
        "            const histFacts = [];\n"
        "\n"
        "            // ① 他对她许过的承诺（最优先，必须认）\n"
        "            for (const pr of wPost.promises || []) {\n"
        "              const t = String(pr?.text || '');\n"
        "              if (!t) continue;\n"
        "              if ((herName && t.includes(herName)) || t.includes('紫嫣') || t.includes('文霞')) {\n"
        "                promiseFacts.push(`他对${herName || '她'}许下过：${t}`);\n"
        "              }\n"
        "            }\n"
        "\n"
        "            // ② 与她的约定\n"
        "            for (const ap of wPost.appointments || []) {\n"
        "              const who = String(ap?.name || ap?.actorId || '');\n"
        "              if (!who || who === herName || who === 'liuwenxia' || /王甯/.test(who)) {\n"
        "                if (ap?.text || ap?.desc) apptFacts.push(`约定：第${ap.day}日${ap.hour ?? ''}时 ${ap.text || ap.desc}`);\n"
        "              }\n"
        "            }\n"
        "\n"
        "            // ③ 他自己账号里跟她的对话（排除别的女人的私话）\n"
        "            try {\n"
        "              const hisHist = this.readHistory('husband');\n"
        "              for (const m of (hisHist.messages || []).slice(-200)) {\n"
        "                const t = String(m?.text || '');\n"
        "                if (!t) continue;\n"
        "                if (/(杨采云|苏慕雪)/.test(t)) continue;\n"
        "                if (/(紫嫣|文霞)/.test(t) || /雅阁/.test(t)) histFacts.push(`他说过/她说过：${t.slice(0, 70)}`);\n"
        "              }\n"
        "            } catch { /* 忽略 */ }\n"
        "\n"
        "            const facts = [\n"
        "              ...promiseFacts.slice(-6),\n"
        "              ...memoryFacts,\n"
        "              ...apptFacts.slice(-4),\n"
        "              ...histFacts.slice(-6),\n"
        "            ].slice(0, 16);\n"
        "\n"
    )
    s = s[:start] + new_block + s[end:]
    print('rewrote facts assembly with priority')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
