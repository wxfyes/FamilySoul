import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'generateCase' not in s:
    anchor = "  // 县衙判案：只依据事实（原告、被告、人证、双方关系），由天道裁定"
    fn = (
        "  // 案情由天道现写：哪座城、谁犯事、犯了什么\n"
        "  async function generateCase() {\n"
        "    try {\n"
        "      const w = peek(DATA_DIR);\n"
        "      const pend = w.flags?.pendingCase;\n"
        "      if (!pend || !pend.city) return;\n"
        "      const pool = Object.values(w.actors || {})\n"
        "        .filter((a) => a && !a.dead && !a.jailed && a.id !== 'husband' && !a.playerControlled)\n"
        "        .filter((a) => !/(知府|县令|知县|尚书|宰相|天子|巡抚|统领|正妻|如夫人|千金)/.test(String(a.role || '')))\n"
        "        .slice(0, 40)\n"
        "        .map((a) => `${a.name}（${a.role || '城中人'}）`);\n"
        "      if (pool.length < 2) { return; }\n"
        "      const prompt = [\n"
        "        `你是天道。${pend.city}民心浮动，今日出了一桩案子。`,\n"
        "        `城中可涉案的人：${pool.join('、')}。`,\n"
        "        '从这些人里挑一个犯事的、一个受害的，写清犯了什么事。',\n"
        "        '只输出 JSON：{\"culprit\":\"名字\",\"victim\":\"名字\",\"crime\":\"一句话(12字内)\",\"place\":\"地点\"}',\n"
        "      ].join('\\n');\n"
        "      const res = await petService.llmClient.complete({\n"
        "        system: '只输出一行 JSON，不要解释。',\n"
        "        messages: [{ role: 'user', content: prompt }],\n"
        "        maxTokens: 160,\n"
        "        temperature: 0.95,\n"
        "      });\n"
        "      const raw = String(res?.text || '');\n"
        "      const m = raw.match(/\\{[\\s\\S]*\\}/);\n"
        "      let d = null;\n"
        "      try { d = m ? JSON.parse(m[0]) : null; } catch { d = null; }\n"
        "      const w2 = peek(DATA_DIR);\n"
        "      w2.flags = w2.flags || {};\n"
        "      w2.flags.pendingCase = null;\n"
        "      const culprit = Object.values(w2.actors || {}).find((a) => a && a.name === String(d?.culprit || ''));\n"
        "      const victim = Object.values(w2.actors || {}).find((a) => a && a.name === String(d?.victim || ''));\n"
        "      if (!culprit || !victim || culprit.id === victim.id) { saveState(DATA_DIR, w2); return; }\n"
        "      w2.cases = Array.isArray(w2.cases) ? w2.cases : [];\n"
        "      w2.flags.caseSeq = (Number(w2.flags.caseSeq) || 0) + 1;\n"
        "      w2.cases.push({\n"
        "        id: `case_${w2.flags.caseSeq}`,\n"
        "        day: w2.clock.day, hour: w2.clock.hour, city: pend.city,\n"
        "        place: culprit.location || null,\n"
        "        who: victim.name, whoId: victim.id,\n"
        "        against: culprit.name, againstId: culprit.id,\n"
        "        claim: String(d?.crime || '犯了事').slice(0, 20),\n"
        "        witnesses: [], status: 'filed', verdict: null, petty: true,\n"
        "      });\n"
        "      saveState(DATA_DIR, w2);\n"
        "      console.log(`[Case] ${pend.city}：${culprit.name}${d?.crime}（告主：${victim.name}）`);\n"
        "    } catch (err) {\n"
        "      console.warn('[Case] 生成案情失败：', err.message);\n"
        "    }\n"
        "  }\n\n"
        "  // 县衙判案：只依据事实（原告、被告、人证、双方关系），由天道裁定"
    )
    s = s.replace(anchor, fn, 1)
    s = s.replace("        await judgeCases();", "        await generateCase();\n        await judgeCases();", 1)
    print('wired generateCase')

# 判词：非临江的案子，关进该城大牢
old = "          culprit.location = culprit.gender === 'male' ? 'jail_male' : 'jail_female';"
new = (
    "          const cityName = String(cc.city || '');\n"
    "          if (cityName && cityName !== '临江府') {\n"
    "            const jailName = `${cityName}·大牢`;\n"
    "            let jp = Object.keys(w3.places || {}).find((k) => w3.places[k]?.name === jailName);\n"
    "            if (!jp) {\n"
    "              w3.flags.placeSeq = (Number(w3.flags.placeSeq) || 0) + 1;\n"
    "              jp = `place_${w3.flags.placeSeq}`;\n"
    "              w3.places[jp] = { name: jailName, exits: ['street'], owner: 'court', dynamic: true, city: cityName };\n"
    "            }\n"
    "            culprit.location = jp;\n"
    "          } else {\n"
    "            culprit.location = culprit.gender === 'male' ? 'jail_male' : 'jail_female';\n"
    "          }"
)
s = s.replace(old, new, 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
