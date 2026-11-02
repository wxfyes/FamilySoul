import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# 服务端：每次 tick 后，把待生成的 NPC 处境补上（每次最多 2 个）
if 'generateNpcArcs' not in s:
    anchor = "  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）"
    fn = (
        "  // NPC 自己的命：每次心跳最多补两个（省 token）\n"
        "  async function generateNpcArcs() {\n"
        "    try {\n"
        "      for (let round = 0; round < 2; round += 1) {\n"
        "        const world = peek(DATA_DIR);\n"
        "        const pending = Object.entries(world.npcArcs || {}).find(([, a]) => a && a.pendingStep);\n"
        "        if (!pending) return;\n"
        "        const [actorId] = pending;\n"
        "        const { npcArcPrompt } = await import('./world/arcs.js');\n"
        "        const prompt = npcArcPrompt(world, actorId);\n"
        "        if (!prompt) {\n"
        "          pending[1].pendingStep = false;\n"
        "          continue;\n"
        "        }\n"
        "        const res = await petService.llmClient.complete({\n"
        "          system: '你是天道，只输出一句处境描写，不写人物反应，不写结局。',\n"
        "          messages: [{ role: 'user', content: prompt }],\n"
        "          maxTokens: 120,\n"
        "          temperature: 0.95,\n"
        "        });\n"
        "        const line = String(res?.text || '').trim().split('\\n')[0].slice(0, 60);\n"
        "        const w2 = peek(DATA_DIR);\n"
        "        const arc = (w2.npcArcs || {})[actorId];\n"
        "        if (arc) {\n"
        "          arc.lastStep = line || arc.lastStep || '（他在自己的事里打转）';\n"
        "          arc.pendingStep = false;\n"
        "          arc.day = w2.clock?.day || 1;\n"
        "          saveState(DATA_DIR, w2);\n"
        "          console.log(`[NpcArc] ${w2.actors?.[actorId]?.name || actorId}：${arc.lastStep.slice(0, 30)}`);\n"
        "        }\n"
        "      }\n"
        "    } catch (err) {\n"
        "      console.warn('[NpcArc] 生成失败：', err.message);\n"
        "    }\n"
        "  }\n\n"
        "  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）"
    )
    s = s.replace(anchor, fn, 1)
    s = s.replace(
        "      onAfterTick: fillProactiveTexts,",
        "      onAfterTick: async () => {\n        await fillProactiveTexts();\n        await generateNpcArcs();\n      },",
        1,
    )
    print('wired npc arc generation')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
