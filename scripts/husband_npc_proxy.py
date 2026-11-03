import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    // 全场收口：一句问话里点了谁，就只留谁的话；旁人（含婉儿）的段落掐掉"
add = (
    "    // 相公号：点了在场的人，模型没写出来 → 单独代演一句（和她的号同等待遇）\n"
    "    try {\n"
    "      if (!this._viewerActorId && /^\\.{2,}$/.test(String(reply || '').trim()) || (!this._viewerActorId && !String(reply || '').trim())) {\n"
    "        const wN = loadState(this.dataDir);\n"
    "        const husN = wN.actors?.husband;\n"
    "        const saidN = String(say || '');\n"
    "        const target = Object.values(wN.actors || {}).find(\n"
    "          (a) => a && !a.dead && a.id !== 'husband' && a.name && a.location === husN?.location && saidN.includes(a.name),\n"
    "        );\n"
    "        if (target) {\n"
    "          const pN = buildProxyPrompt({\n"
    "            actor: target,\n"
    "            memories: (wN.memories || []).filter((m) => String(m?.text || '').includes(target.name)).map((m) => String(m.text)).slice(-4),\n"
    "            facts: (wN.npcArcs?.[target.id]?.lastStep ? [`你眼下的事：${wN.npcArcs[target.id].lastStep}`] : []),\n"
    "            hearerName: husN?.name || '相公',\n"
    "            hearerPlace: String(wN.places?.[husN?.location]?.name || ''),\n"
    "            said: saidN.slice(0, 120),\n"
    "            recent: '',\n"
    "          });\n"
    "          const resN = await this.llmClient.complete({\n"
    "            system: pN.system, messages: [{ role: 'user', content: pN.user }], maxTokens: 150, temperature: 0.85,\n"
    "          });\n"
    "          const lineN = wrapProxyLine(target.name, resN?.text);\n"
    "          if (lineN) {\n"
    "            reply = lineN;\n"
    "            const wSave = loadState(this.dataDir);\n"
    "            wSave.chatPartners = wSave.chatPartners || {};\n"
    "            wSave.chatPartners.husband = target.id;\n"
    "            saveState(this.dataDir, wSave);\n"
    "            console.log('[Proxy] 补代演' + target.name + '：' + lineN.slice(0, 30));\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 全场收口：一句问话里点了谁，就只留谁的话；旁人（含婉儿）的段落掐掉"
)
if old in s and '补代演' not in s:
    s = s.replace(old, add, 1)
    print('added husband-account npc proxy fallback')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
