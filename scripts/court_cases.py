import io

# ① dispatch：报官 op
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      } else if (kind === 'move') {"
inject = (
    "      } else if (kind === 'report') {\n"
    "        // 报官：只记事实（谁、告谁、告什么、有什么人证），不写细节\n"
    "        const who = resolveActor(world, args.who || args.by);\n"
    "        const against = resolveActor(world, args.against || args.to);\n"
    "        const claim = String(args.claim || args.text || '').slice(0, 60);\n"
    "        if (!who || !against || !claim) continue;\n"
    "        world.cases = Array.isArray(world.cases) ? world.cases : [];\n"
    "        const witnesses = Object.values(world.actors || {})\n"
    "          .filter((a) => a && !a.dead && a.id !== who && a.id !== against && a.location === world.actors[who]?.location)\n"
    "          .map((a) => a.name);\n"
    "        world.flags = world.flags || {};\n"
    "        world.flags.caseSeq = (Number(world.flags.caseSeq) || 0) + 1;\n"
    "        world.cases.push({\n"
    "          id: `case_${world.flags.caseSeq}`,\n"
    "          day: world.clock.day, hour: world.clock.hour,\n"
    "          place: world.actors[who]?.location || null,\n"
    "          who: world.actors[who]?.name || who, whoId: who,\n"
    "          against: world.actors[against]?.name || against, againstId: against,\n"
    "          claim, witnesses, status: 'filed', verdict: null,\n"
    "        });\n"
    "        events.push(nextEvent(world, { actor: who, action: 'report', place: 'yamen', payload: { text: `${world.actors[who]?.name}到县衙告${world.actors[against]?.name}` }, isPublic: true }));\n"
    "        applied.push(`报官:${world.actors[who]?.name}告${world.actors[against]?.name}`);\n"
    "      } else if (kind === 'move') {"
)
if anchor in s and "kind === 'report'" not in s:
    s = s.replace(anchor, inject, 1)
    print('added report op')

io.open(p, 'w', encoding='utf-8').write(s)

# ② server：天道判案（每个新案子判一次）
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'judgeCases' not in s2:
    anchor2 = "  // 天下不止一座城：走到哪座城，天道就把那条街补出来（分批长到 12 家）"
    fn = (
        "  // 县衙判案：只依据事实（原告、被告、人证、双方关系），由天道裁定\n"
        "  async function judgeCases() {\n"
        "    try {\n"
        "      const w = peek(DATA_DIR);\n"
        "      const c = (w.cases || []).find((x) => x && x.status === 'filed');\n"
        "      if (!c) return;\n"
        "      const w2 = peek(DATA_DIR);\n"
        "      const mag = Object.values(w2.actors || {}).find((a) => a && /县令/.test(String(a.role || '')));\n"
        "      const prompt = [\n"
        "        '你是天道，扮演临江县令周文达断案。',\n"
        "        `原告：${c.who}。被告：${c.against}。所告：${c.claim}。`,\n"
        "        `现场人证：${(c.witnesses || []).join('、') || '无'}。`,\n"
        "        `县令本人收过钱通海的礼（这条是秘密，他判的时候会偏向有钱有势的一方）。`,\n"
        "        '只输出 JSON：{\"verdict\":\"guilty|false\",\"reason\":\"一句话判词(20字内)\",\"penalty\":{\"silver\":0,\"wanted\":0,\"rep\":0}}',\n"
        "        '被告有罪则 guilty（罚银/加通缉/掉名声）；证据不足或原告诬告则 false（原告反坐）。',\n"
        "      ].join('\\n');\n"
        "      const res = await petService.llmClient.complete({\n"
        "        system: '只输出一行 JSON，不要解释。',\n"
        "        messages: [{ role: 'user', content: prompt }],\n"
        "        maxTokens: 160,\n"
        "        temperature: 0.7,\n"
        "      });\n"
        "      const raw = String(res?.text || '');\n"
        "      const m = raw.match(/\\{[\\s\\S]*\\}/);\n"
        "      let d = { verdict: 'false', reason: '证据不足', penalty: {} };\n"
        "      try { if (m) d = { ...d, ...JSON.parse(m[0]) }; } catch { /* 默认 */ }\n"
        "      const w3 = peek(DATA_DIR);\n"
        "      const cc = (w3.cases || []).find((x) => x && x.id === c.id);\n"
        "      if (!cc) return;\n"
        "      cc.status = 'judged';\n"
        "      cc.verdict = d.verdict;\n"
        "      cc.reason = String(d.reason || '').slice(0, 40);\n"
        "      const pen = d.penalty || {};\n"
        "      const silver = Math.max(0, Number(pen.silver) || 0);\n"
        "      if (d.verdict === 'guilty') {\n"
        "        if (silver > 0) w3.assets.silver = Math.round(((Number(w3.assets.silver) || 0) - silver) * 100) / 100;\n"
        "        if (Number(pen.wanted) > 0) w3.flags.wanted = (Number(w3.flags.wanted) || 0) + Number(pen.wanted);\n"
        "        if (Number(pen.rep) > 0) w3.reputation = Math.max(0, (Number(w3.reputation) || 50) - Number(pen.rep));\n"
        "      } else {\n"
        "        const plaintiff = w3.actors?.[cc.whoId];\n"
        "        if (plaintiff) {\n"
        "          plaintiff.relations = plaintiff.relations || {};\n"
        "          plaintiff.relations.husband = plaintiff.relations.husband || { trust: 30, desire: 0, fear: 0, grievance: 0 };\n"
        "          plaintiff.relations.husband.trust = Math.max(0, (Number(plaintiff.relations.husband.trust) || 30) - 10);\n"
        "          plaintiff.relations.husband.grievance = Math.min(100, (Number(plaintiff.relations.husband.grievance) || 0) + 10);\n"
        "        }\n"
        "      }\n"
        "      saveState(DATA_DIR, w3);\n"
        "      console.log(`[Court] 判案 ${cc.who} 告 ${cc.against}：${cc.reason}（${cc.verdict}）`);\n"
        "    } catch (err) {\n"
        "      console.warn('[Court] 判案失败：', err.message);\n"
        "    }\n"
        "  }\n\n"
        "  // 天下不止一座城：走到哪座城，天道就把那条街补出来（分批长到 12 家）"
    )
    s2 = s2.replace(anchor2, fn, 1)
    s2 = s2.replace("        await generateCityShops();", "        await generateCityShops();\n        await judgeCases();", 1)
    print('wired judgeCases')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
