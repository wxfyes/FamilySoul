import io

# ① 折子：每天可能有人弹劾地方官
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "function markCourtDecree(world) {"
fn = (
    "/** 御案上的折子：言官会弹劾地方官 */\n"
    "function runMemorials(world, events) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  if (day % 4 !== 0) return;\n"
    "  if (Math.random() > 0.5) return;\n"
    "  const officials = Object.entries(world.court?.offices || {})\n"
    "    .filter(([k, o]) => o && o.holder && k.startsWith('city:'))\n"
    "    .map(([, o]) => o);\n"
    "  if (!officials.length) return;\n"
    "  const off = officials[Math.floor(Math.random() * officials.length)];\n"
    "  const holder = world.actors?.[off.holder];\n"
    "  if (!holder) return;\n"
    "  world.memorials = Array.isArray(world.memorials) ? world.memorials : [];\n"
    "  if (world.memorials.some((m) => m && m.againstId === holder.id && m.status === 'pending')) return;\n"
    "  world.flags = world.flags || {};\n"
    "  world.flags.memorialSeq = (Number(world.flags.memorialSeq) || 0) + 1;\n"
    "  const claims = ['贪墨税银', '纵容家奴横行', '虚报灾情冒赈', '办案受贿', '私加火耗'];\n"
    "  world.memorials.push({\n"
    "    id: `memorial_${world.flags.memorialSeq}`,\n"
    "    against: holder.name, againstId: holder.id, office: off.title || '',\n"
    "    claim: claims[Math.floor(Math.random() * claims.length)],\n"
    "    day, status: 'pending',\n"
    "  });\n"
    "  events.push(nextEvent(world, { action: 'memorial', actor: 'court', place: null, payload: { text: `御案上多了一份弹劾${holder.name}的折子` }, isPublic: true }));\n"
    "}\n\n"
    "function markCourtDecree(world) {"
)
if anchor in s and 'runMemorials' not in s:
    s = s.replace(anchor, fn, 1)
    s = s.replace("  consumeSupplies(world);", "  try {\n    runMemorials(world, events);\n  } catch (err) {\n    console.warn('[Court] 折子失败：', err.message);\n  }\n  consumeSupplies(world);", 1)
    print('added memorials')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 朝议时天道处置折子：罢官/留任
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'resolveMemorials' not in s2:
    anchor2 = "  // 案情由天道现写：哪座城、谁犯事、犯了什么"
    fn2 = (
        "  // 御案折子：天道（皇帝）批：查实罢官，或留任\n"
        "  async function resolveMemorials() {\n"
        "    try {\n"
        "      const w = peek(DATA_DIR);\n"
        "      const m = (w.memorials || []).find((x) => x && x.status === 'pending');\n"
        "      if (!m) return;\n"
        "      const official = w.actors?.[m.againstId];\n"
        "      if (!official) { return; }\n"
        "      const prompt = [\n"
        "        '你是天道，扮演天子批折子。',\n"
        "        `有人弹劾${m.office || ''}${m.against}：${m.claim}。`,\n"
        "        `此人风评：对相公信任 ${official.relations?.husband?.trust ?? 30}，怨怼 ${official.relations?.husband?.grievance ?? 0}。`,\n"
        "        '只输出 JSON：{\"action\":\"dismiss|keep\",\"reason\":\"一句批语(16字内)\"}',\n"
        "      ].join('\\n');\n"
        "      const res = await petService.llmClient.complete({\n"
        "        system: '只输出一行 JSON，不要解释。',\n"
        "        messages: [{ role: 'user', content: prompt }],\n"
        "        maxTokens: 120,\n"
        "        temperature: 0.7,\n"
        "      });\n"
        "      const raw = String(res?.text || '');\n"
        "      const mm = raw.match(/\\{[\\s\\S]*\\}/);\n"
        "      let d = { action: 'keep', reason: '查无实据' };\n"
        "      try { if (mm) d = { ...d, ...JSON.parse(mm[0]) }; } catch { /* 默认 */ }\n"
        "      const w2 = peek(DATA_DIR);\n"
        "      const m2 = (w2.memorials || []).find((x) => x && x.id === m.id);\n"
        "      if (!m2) return;\n"
        "      m2.status = d.action === 'dismiss' ? 'dismissed' : 'kept';\n"
        "      m2.reason = String(d.reason || '').slice(0, 30);\n"
        "      if (d.action === 'dismiss') {\n"
        "        for (const [key, off] of Object.entries(w2.court?.offices || {})) {\n"
        "          if (off && off.holder === m.againstId) {\n"
        "            off.holder = null;\n"
        "            off.vacant = true;\n"
        "            (w2.court.vacancies = w2.court.vacancies || []).push({ key, title: off.title, day: w2.clock.day });\n"
        "          }\n"
        "        }\n"
        "        const a = w2.actors?.[m.againstId];\n"
        "        if (a) { a.role = '罢官闲居'; a.home = a.home || 'street'; }\n"
        "      }\n"
        "      saveState(DATA_DIR, w2);\n"
        "      console.log(`[Court] 批折子：${m.against}——${m2.reason}（${m2.status}）`);\n"
        "    } catch (err) {\n"
        "      console.warn('[Court] 批折子失败：', err.message);\n"
        "    }\n"
        "  }\n\n"
        "  // 案情由天道现写：哪座城、谁犯事、犯了什么"
    )
    s2 = s2.replace(anchor2, fn2, 1)
    s2 = s2.replace("        await judgeCases();", "        await judgeCases();\n        await resolveMemorials();", 1)
    print('wired resolveMemorials')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
