import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'generateDecree' not in s:
    anchor = "  // NPC 自己的命：每次心跳最多补两个（省 token）"
    fn = (
        "  // 朝议：每 5 天由天道下一道旨（加税/赈灾/征役…），进而推动民心\n"
        "  async function generateDecree() {\n"
        "    try {\n"
        "      const world = peek(DATA_DIR);\n"
        "      if (!world.court?.pendingDecree) return;\n"
        "      const day = world.clock?.day || 1;\n"
        "      const cities = Object.values(world.cities || {}).filter(Boolean);\n"
        "      const unrest = cities.length\n"
        "        ? Math.round(cities.reduce((s, c) => s + (Number(c.unrest) || 0), 0) / cities.length)\n"
        "        : 0;\n"
        "      const tax = cities.length\n"
        "        ? Math.round(cities.reduce((s, c) => s + (Number(c.tax) || 0), 0) / cities.length)\n"
        "        : 10;\n"
        "      const prompt = [\n"
        "        `你是天道，扮演大乾朝廷。第${day}日朝议。`,\n"
        "        `天下平均民心不安度 ${unrest}/100，平均税率 ${tax}%。`,\n"
        "        '请下一道旨：要么加税、减税、征役、赈灾、严打、大赦之一。',\n"
        "        '只输出 JSON：{\"decree\":\"一句旨意(20字内)\",\"action\":\"raise_tax|lower_tax|corvee|relief|crackdown|amnesty\",\"amount\":10}',\n"
        "      ].join('\\n');\n"
        "      const res = await petService.llmClient.complete({\n"
        "        system: '你只输出一行 JSON，不要解释。',\n"
        "        messages: [{ role: 'user', content: prompt }],\n"
        "        maxTokens: 120,\n"
        "        temperature: 0.9,\n"
        "      });\n"
        "      const raw = String(res?.text || '');\n"
        "      const m = raw.match(/\\{[\\s\\S]*\\}/);\n"
        "      let d = { decree: '朝廷下旨', action: 'raise_tax', amount: 10 };\n"
        "      if (m) {\n"
        "        try {\n"
        "          d = { ...d, ...JSON.parse(m[0]) };\n"
        "        } catch { /* 用默认 */ }\n"
        "      }\n"
        "      const { applyDecree } = await import('./world/clock.js');\n"
        "      const w2 = peek(DATA_DIR);\n"
        "      const events = [];\n"
        "      applyDecree(w2, events, d);\n"
        "      w2.court.pendingDecree = false;\n"
        "      saveState(DATA_DIR, w2);\n"
        "      console.log(`[Court] 第${day}日朝议：${String(d.decree).slice(0, 30)}（${d.action} ${d.amount}）`);\n"
        "    } catch (err) {\n"
        "      console.warn('[Court] 朝议生成失败：', err.message);\n"
        "    }\n"
        "  }\n\n"
        "  // NPC 自己的命：每次心跳最多补两个（省 token）"
    )
    s = s.replace(anchor, fn, 1)
    s = s.replace(
        "        await generateNpcArcs();",
        "        await generateNpcArcs();\n        await generateDecree();",
        1,
    )
    print('wired decree generation')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
