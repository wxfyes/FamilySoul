import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 编造旧事 → 让天道自己重写一遍（不换模板）
anchor = "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
block = (
    "    // 账本没有的往事：让天道自己重写一版（不替它写台词）\n"
    "    try {\n"
    "      const askP2 = /(还记得|记不记得|记得吗|以前|上次|那回|从前|当年|旧事)/.test(String(say || ''));\n"
    "      const looksFabricated = /(记得|从前|那时|当年|上次|那回|你总|你总是|你那时)/.test(String(reply || ''));\n"
    "      if (askP2 && looksFabricated) {\n"
    "        const wR = loadState(this.dataDir);\n"
    "        const meR = this._viewerActorId ? wR.actors?.[this._viewerActorId] : wR.actors?.husband;\n"
    "        const hereR = Object.values(wR.actors || {}).filter((a) => a && !a.dead && a.location === meR?.location && a.id !== 'husband' && a.id !== this._viewerActorId);\n"
    "        const namesR = hereR.map((a) => a.name);\n"
    "        const poolR = (wR.memories || []).filter((m) => {\n"
    "          const t = String(m?.text || '');\n"
    "          return namesR.some((n) => t.includes(n)) || t.includes('相公') || m.visible === 'public';\n"
    "        });\n"
    "        if (poolR.length === 0) {\n"
    "          const speaker = (String(reply || '').match(/^【([^】\\n]{1,12})】/) || [])[1] || (hereR[0]?.name || '她');\n"
    "          const rr = await this.llmClient.complete({\n"
    "            system: `你就是${speaker}。账本里没有对方说的那件旧事。`, messages: [{\n"
    "              role: 'user',\n"
    "              content: `对方问：“${String(say).slice(0, 60)}”。账本里没有这件事。请用一句到两句、${speaker}自己的口吻回答：记不得、或含混带过，绝不许编任何具体往事、细节、物件、场景。只输出台词，以【${speaker}】：开头。`,\n"
    "            }], maxTokens: 120, temperature: 0.8,\n"
    "          });\n"
    "          const rewritten = String(rr?.text || '').trim();\n"
    "          if (rewritten) {\n"
    "            reply = wrapProxyLine(speaker, rewritten) || rewritten;\n"
    "            console.log('[Memory] 已让天道重写（账本无此事）');\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
)
if anchor in s and '已让天道重写' not in s:
    s = s.replace(anchor, block, 1)
    print('patched: rewrite fabricated past via llm')

# ② 府里人不再走"报位置"那条（避免重复）
old2 = "      if (absent && !String(reply || '').includes(String(wAbs.places?.[absent.location]?.name || ''))) {"
new2 = (
    "      const absentIsHousehold = absent && (absent.household || ['waner', 'yunnia', 'xiaocui'].includes(absent.id));\n"
    "      if (absent && !absentIsHousehold && !String(reply || '').includes(String(wAbs.places?.[absent.location]?.name || ''))) {"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: household skips locate line')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
