import io

p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

# 找到 1368 行（1-based）的 "try {" 与 1393 的 "} catch { /* 忽略 */ }"
start = None
for i in range(1360, 1380):
    if lines[i].strip() == 'try {' and 'events.jsonl' in lines[i+1]:
        start = i
        break
if start is None:
    print('WARN: events try not found')
else:
    end = None
    for j in range(start, start + 40):
        if 'nothing' in lines[j]:
            pass
        if lines[j].strip() == "} catch { /* 忽略 */ }":
            end = j
            break
    if end is None:
        print('WARN: events try end not found')
    else:
        new_block = [
            "            try {",
            "              const evFile = path.join(this.dataDir, 'world', 'events.jsonl');",
            "              if (fs.existsSync(evFile)) {",
            "                const lines = fs.readFileSync(evFile, 'utf8').trim().split('\\n').slice(-80);",
            "                for (const line of lines) {",
            "                  try {",
            "                    const e = JSON.parse(line);",
            "                    const t = String(e?.payload?.text || '');",
            "                    if (!t) continue;",
            "                    if (t.includes('雅阁') || (herName && t.includes(herName)) || t.includes('王甯')) facts.push(t);",
            "                  } catch { /* 忽略 */ }",
            "                }",
            "              }",
            "            } catch { /* 忽略 */ }",
            "            // 他自己账号里跟她聊过的事，也算他的记忆",
            "            try {",
            "              const hisHist = this.readHistory('husband');",
            "              const hisLines = (hisHist.messages || [])",
            "                .filter((m) => /(雅阁|紫嫣|文霞)/.test(String(m?.text || '')))",
            "                .slice(-8)",
            "                .map((m) => String(m.text).slice(0, 80));",
            "              for (const l of hisLines) facts.push(l);",
            "            } catch { /* 忽略 */ }",
        ]
        lines = lines[:start] + new_block + lines[end+1:]
        print('rewrote events + husband-history block')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('ok')
