import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 问\"某人在哪\"：直接给准确位置"
add = (
    "    // 诊脉：问到怀孕/喜脉，就把账本上的身子实情摆出来\n"
    "    try {\n"
    "      if (/(诊脉|把脉|怀孕|有喜|喜脉|身子|身孕|怀上)/.test(String(say || ''))) {\n"
    "        const wQ = loadState(this.dataDir);\n"
    "        const meQ = this._viewerActorId ? wQ.actors?.[this._viewerActorId] : wQ.actors?.husband;\n"
    "        const hereQ = Object.values(wQ.actors || {}).filter(\n"
    "          (a) => a && !a.dead && a.id !== 'husband' && a.id !== this._viewerActorId\n"
    "            && (a.location === meQ?.location || a.household),\n"
    "        );\n"
    "        const preg = hereQ.filter((a) => a.pregnancy && !a.pregnancy.born);\n"
    "        const askedWho = hereQ.find((a) => {\n"
    "          if (!a.name) return false;\n"
    "          const short = a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
    "          return String(say || '').includes(a.name) || String(say || '').includes(short);\n"
    "        });\n"
    "        if (askedWho && askedWho.pregnancy && !askedWho.pregnancy.born) {\n"
    "          contextHint += `（【诊脉】${askedWho.name}确有身孕，已 ${askedWho.pregnancy.days} 天。这是账本事实，不许说没有。）\\n`;\n"
    "        } else if (askedWho) {\n"
    "          contextHint += `（【诊脉】${askedWho.name}没有身孕。这是账本事实，不许说有了。）\\n`;\n"
    "        } else if (preg.length) {\n"
    "          contextHint += `（【诊脉】府里有孕的：${preg.map((a) => `${a.name}（${a.pregnancy.days} 天）`).join('、')}。这是账本事实。）\\n`;\n"
    "        } else {\n"
    "          contextHint += '（【诊脉】府里眼下没有谁有身孕。这是账本事实，不许编一个有孕的。）\\n';\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 问\"某人在哪\"：直接给准确位置"
)
if anchor in s and '【诊脉】' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: pregnancy facts in context')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
