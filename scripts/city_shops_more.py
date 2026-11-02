import io

# ① 到达时：没铺满就继续补（每城最多 12 家）
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "          const cityName = Object.keys(world.cities || {}).find((c) => String(p.name || '').includes(c) || String(c).includes(String(p.name || '')));\n"
    "          if (cityName && !(world.cityShops || {})[cityName]) {\n"
    "            world.flags = world.flags || {};\n"
    "            world.flags.pendingCityShop = cityName;\n"
    "          }"
)
new = (
    "          const cityName = Object.keys(world.cities || {}).find((c) => String(p.name || '').includes(c) || String(c).includes(String(p.name || '')));\n"
    "          if (cityName) {\n"
    "            world.cityShops = world.cityShops || {};\n"
    "            const rec = world.cityShops[cityName];\n"
    "            const count = typeof rec === 'number' ? rec : (rec && rec.count) || 0;\n"
    "            if (count < 12) {\n"
    "              world.flags = world.flags || {};\n"
    "              world.flags.pendingCityShop = cityName;\n"
    "            }\n"
    "          }"
)
if old in s:
    s = s.replace(old, new)
    print('patched: keep filling until 12')
else:
    print('WARN: city mark block not found')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 生成：看已有铺子，补缺的类别，一次 4 家，最多 12 家
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

start = s2.find("  // 天下不止一座城：走到哪座城，天道就把那条街补出来（每城一次）")
end = s2.find("  // 朝议：每 5 天由天道下一道旨", start)
if start < 0 or end < 0:
    print('WARN: city fn not found')
else:
    fn = (
        "  // 天下不止一座城：走到哪座城，天道就把那条街补出来（分批长到 12 家）\n"
        "  async function generateCityShops() {\n"
        "    try {\n"
        "      const w = peek(DATA_DIR);\n"
        "      const city = String(w.flags?.pendingCityShop || '');\n"
        "      if (!city) return;\n"
        "      const existing = Object.values(w.places || {})\n"
        "        .filter((p) => p && String(p.name || '').includes(city))\n"
        "        .map((p) => String(p.name).replace(`${city}·`, ''));\n"
        "      const have = existing.join('、') || '（还没有）';\n"
        "      const prompt = [\n"
        "        `你是天道，正在铺设${city}的街市。`,\n"
        "        `已有铺子：${have}。`,\n"
        "        '再补 4 家这条街还没有的铺子，要覆盖柴米油盐、瓜果梨枣、糕点甜食、酒肉鱼虾、布帛针线、香烛纸马、书坊笔墨、木作砖瓦这类营生。',\n"
        "        '只输出 JSON 数组：[{\"shop\":\"铺名\",\"kind\":\"行当\",\"who\":\"掌柜名\",\"role\":\"掌柜身份\"}]',\n"
        "        '不要和已有铺子重复，不要四家都是同一种生意。',\n"
        "      ].join('\\n');\n"
        "      const res = await petService.llmClient.complete({\n"
        "        system: '只输出 JSON 数组，不要解释。',\n"
        "        messages: [{ role: 'user', content: prompt }],\n"
        "        maxTokens: 280,\n"
        "        temperature: 0.95,\n"
        "      });\n"
        "      const raw = String(res?.text || '');\n"
        "      const m = raw.match(/\\[[\\s\\S]*\\]/);\n"
        "      let list = [];\n"
        "      try { list = m ? JSON.parse(m[0]) : []; } catch { list = []; }\n"
        "      const w2 = peek(DATA_DIR);\n"
        "      w2.flags = w2.flags || {};\n"
        "      w2.flags.pendingCityShop = '';\n"
        "      w2.cityShops = w2.cityShops || {};\n"
        "      const rec = w2.cityShops[city];\n"
        "      let count = typeof rec === 'number' ? rec : (rec && rec.count) || 0;\n"
        "      w2.places = w2.places || {};\n"
        "      let made = 0;\n"
        "      for (const item of Array.isArray(list) ? list.slice(0, 4) : []) {\n"
        "        const shop = String(item?.shop || '').slice(0, 12);\n"
        "        const who = String(item?.who || '').slice(0, 8);\n"
        "        const kind = String(item?.kind || '铺子').slice(0, 8);\n"
        "        const role = String(item?.role || kind).slice(0, 12);\n"
        "        if (!shop || !who) continue;\n"
        "        const fullName = `${city}·${shop}`.slice(0, 20);\n"
        "        if (Object.values(w2.places).some((p) => p && p.name === fullName)) continue;\n"
        "        if (Object.values(w2.actors).some((a) => a?.name === who)) continue;\n"
        "        w2.flags.placeSeq = (Number(w2.flags.placeSeq) || 0) + 1;\n"
        "        const pid = `place_${w2.flags.placeSeq}`;\n"
        "        w2.places[pid] = { name: fullName, exits: ['street'], dynamic: true, city, shopKind: kind };\n"
        "        w2.flags.npcSeq = (Number(w2.flags.npcSeq) || 0) + 1;\n"
        "        const nid = `npc_${w2.flags.npcSeq}`;\n"
        "        w2.actors[nid] = {\n"
        "          id: nid, name: who, role, gender: 'female', origin: 'spawned',\n"
        "          home: pid, location: pid, city,\n"
        "          relations: { husband: { trust: 30, desire: 10, fear: 0, grievance: 0 } },\n"
        "          schedule: [], goals: [],\n"
        "        };\n"
        "        made += 1;\n"
        "      }\n"
        "      count += made;\n"
        "      w2.cityShops[city] = { count, done: count >= 12 };\n"
        "      saveState(DATA_DIR, w2);\n"
        "      console.log(`[City] ${city} 补出 ${made} 家铺子（累计 ${count}/12）`);\n"
        "    } catch (err) {\n"
        "      console.warn('[City] 补街市失败：', err.message);\n"
        "    }\n"
        "  }\n\n"
    )
    s2 = s2[:start] + fn + s2[end:]
    print('rewrote city shop generation (incremental, 12 max)')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
