import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
block = (
    "    // 最后兜底：若只剩场景旁白，而在场有人 → 让他开口说一句\n"
    "    try {\n"
    "      const isNarration = /^(【[^】]+】：)?\\s*[^【]*(就站在|四下冷清|你到了|没人接话|没人应声)/.test(String(reply || ''));\n"
    "      if (isNarration) {\n"
    "        const wL = loadState(this.dataDir);\n"
    "        const meL = this._viewerActorId ? wL.actors?.[this._viewerActorId] : wL.actors?.husband;\n"
    "        const hereL = Object.values(wL.actors || {})\n"
    "          .filter((a) => a && !a.dead && a.id !== 'husband' && a.id !== this._viewerActorId && a.location === meL?.location)\n"
    "          .sort((x, y) => (Number(y.relations?.husband?.trust) || 0) - (Number(x.relations?.husband?.trust) || 0));\n"
    "        const pickL = hereL[0];\n"
    "        if (pickL) {\n"
    "          const pL = buildProxyPrompt({\n"
    "            actor: pickL,\n"
    "            memories: (wL.memories || []).filter((m) => String(m?.text || '').includes(pickL.name)).map((m) => String(m.text)).slice(-3),\n"
    "            facts: wL.npcArcs?.[pickL.id]?.lastStep ? [`你眼下的事：${wL.npcArcs[pickL.id].lastStep}`] : [],\n"
    "            hearerName: meL?.name || '相公',\n"
    "            hearerPlace: String(wL.places?.[meL?.location]?.name || ''),\n"
    "            said: String(say || '').slice(0, 120),\n"
    "            recent: '',\n"
    "          });\n"
    "          const rL = await this.llmClient.complete({\n"
    "            system: pL.system, messages: [{ role: 'user', content: pL.user }], maxTokens: 150, temperature: 0.85,\n"
    "          });\n"
    "          const lineL = wrapProxyLine(pickL.name, rL?.text);\n"
    "          if (lineL) {\n"
    "            reply = lineL;\n"
    "            console.log('[Proxy] 旁白兜底 → ' + pickL.name + '：' + lineL.slice(0, 24));\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
)
if anchor in s and '旁白兜底' not in s:
    s = s.replace(anchor, block, 1)
    print('patched: narration fallback forces npc line')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
