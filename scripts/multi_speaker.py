import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
block = (
    "    // 点了好几个人：每人都得应一声，不许只有一个回\n"
    "    try {\n"
    "      const wM = loadState(this.dataDir);\n"
    "      const meM = this._viewerActorId ? wM.actors?.[this._viewerActorId] : wM.actors?.husband;\n"
    "      const saidM = String(say || '');\n"
    "      const named = Object.values(wM.actors || {}).filter((a) => {\n"
    "        if (!a || a.dead || !a.name || a.id === this._viewerActorId) return false;\n"
    "        if (a.location !== meM?.location) return false;\n"
    "        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
    "        return saidM.includes(a.name) || (short && saidM.includes(short));\n"
    "      }).slice(0, 3);\n"
    "      if (named.length >= 2) {\n"
    "        for (const who of named) {\n"
    "          const already = new RegExp(`【[^】]*${String(who.name).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`).test(String(reply || ''));\n"
    "          if (already) continue;\n"
    "          const pM = buildProxyPrompt({\n"
    "            actor: who,\n"
    "            memories: (wM.memories || []).filter((m) => String(m?.text || '').includes(who.name)).map((m) => String(m.text)).slice(-3),\n"
    "            facts: wM.npcArcs?.[who.id]?.lastStep ? [`你眼下的事：${wM.npcArcs[who.id].lastStep}`] : [],\n"
    "            hearerName: meM?.name || '相公',\n"
    "            hearerPlace: String(wM.places?.[meM?.location]?.name || ''),\n"
    "            said: saidM.slice(0, 120),\n"
    "            recent: '',\n"
    "          });\n"
    "          const rM = await this.llmClient.complete({\n"
    "            system: pM.system, messages: [{ role: 'user', content: pM.user }], maxTokens: 150, temperature: 0.85,\n"
    "          });\n"
    "          const lineM = wrapProxyLine(who.name, rM?.text);\n"
    "          if (lineM) {\n"
    "            reply = `${String(reply || '').trim()}\\n${lineM}`.trim();\n"
    "            console.log('[Proxy] 补' + who.name + '一句：' + lineM.slice(0, 24));\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
)
if anchor in s and '点了好几个人' not in s:
    s = s.replace(anchor, block, 1)
    print('patched: every named present actor answers')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
