import io

# 她在场时：如果 arc 需要下一步，调一次小模型生成
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'arcStepPrompt' not in s:
    s = s.replace(
        "import { buildMemberCard } from './world/member-card.js';",
        "import { buildMemberCard } from './world/member-card.js';\nimport { arcStepPrompt } from './world/arcs.js';",
    )
    print('imported arcStepPrompt')

anchor = "    // 她一开口就算\"在行动\"，主线不会因为躺平被世界替她定夺"
block = (
    "    // 天道定下一步：她被推进了新的处境，就现生成那句（不写死）\n"
    "    try {\n"
    "      if (this._viewerActorId) {\n"
    "        const wArc = loadState(this.dataDir);\n"
    "        const arc = wArc.arcs?.[this._viewerActorId];\n"
    "        if (arc && arc.pendingStep) {\n"
    "          const prompt = arcStepPrompt(wArc, this._viewerActorId);\n"
    "          if (prompt) {\n"
    "            const gen = await this.llmClient.complete({\n"
    "              system: '你是天道，只输出一句处境描写，不写人物反应，不写结局。',\n"
    "              messages: [{ role: 'user', content: prompt }],\n"
    "              maxTokens: 120,\n"
    "              temperature: 0.9,\n"
    "            });\n"
    "            const line = String(gen?.text || '').trim().split('\\n')[0].slice(0, 60);\n"
    "            const w2 = loadState(this.dataDir);\n"
    "            if (line && w2.arcs?.[this._viewerActorId]) {\n"
    "              const a2 = w2.arcs[this._viewerActorId];\n"
    "              a2.lastStep = line;\n"
    "              a2.pendingStep = false;\n"
    "              a2.log = Array.isArray(a2.log) ? a2.log : [];\n"
    "              a2.log.push({ day: w2.clock.day, text: line });\n"
    "              if (a2.log.length > 20) a2.log = a2.log.slice(-20);\n"
    "              saveState(this.dataDir, w2);\n"
    "              console.log('[Arc] 天道生成下一步：' + line);\n"
    "            }\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    } catch (err) {\n"
    "      console.warn('[Arc] 生成下一步失败：', err.message);\n"
    "    }\n\n"
)
if anchor in s and '天道定下一步' not in s:
    s = s.replace(anchor, block + anchor, 1)
    print('added dynamic arc step generation')
else:
    print('WARN: anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)

# member-card 与 /api/me 用 lastStep
p2 = 'src/world/member-card.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
s2 = s2.replace(
    "  const step = arcStepText(actorId, arc);",
    "  const step = arc.lastStep || arcStepText(actorId, arc);",
)
io.open(p2, 'w', encoding='utf-8').write(s2)

p3 = 'src/server.js'
s3 = io.open(p3, encoding='utf-8-sig').read()
s3 = s3.replace(
    "                  return arcStepText(actorId, arc);",
    "                  return arc.lastStep || arcStepText(actorId, arc);",
)
io.open(p3, 'w', encoding='utf-8').write(s3)
print('ok')
