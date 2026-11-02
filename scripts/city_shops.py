import io

# ① 走到某城 → 标记"这条街还没长出来"
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      if (me.location !== pid) {\n        me.location = pid;\n        saveState(dataDir, world);\n        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: p.name };"
add = (
    "      if (me.location !== pid) {\n"
    "        me.location = pid;\n"
    "        // 到了从没去过的城 → 让天道把这条街补出来\n"
    "        try {\n"
    "          const cityName = Object.keys(world.cities || {}).find((c) => String(p.name || '').includes(c) || String(c).includes(String(p.name || '')));\n"
    "          if (cityName && !(world.cityShops || {})[cityName]) {\n"
    "            world.flags = world.flags || {};\n"
    "            world.flags.pendingCityShop = cityName;\n"
    "          }\n"
    "        } catch { /* 忽略 */ }\n"
    "        saveState(dataDir, world);\n"
    "        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: p.name };"
)
if anchor in s and 'pendingCityShop' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: mark city when arriving')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 服务端：给这个城补 3-4 家铺子
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'generateCityShops' not in s2:
    anchor2 = "  // 朝议：每 5 天由天道下一道旨"
    fn = (
        "  // 天下不止一座城：走到哪座城，天道就把那条街补出来（每城一次）\n"
        "  async function generateCityShops() {\n"
        "    try {\n"
        "      const w = peek(DATA_DIR);\n"
        "      const city = String(w.flags?.pendingCityShop || '');\n"
        "      if (!city) return;\n"
        "      const regions = Object.keys(w.cities || {});\n"
        "      const prompt = [\n"
        "        `你是天道，正在铺设${city}的街市。`,\n"
        "        '给这座城写 4 家铺子，各配一个当家的。只输出 JSON 数组：',\n"
        "        '[{\"shop\":\"铺名\",\"kind\":\"行当\",\"who\":\"掌柜名\",\"role\":\"掌柜身份\"}]',\n"
        "        '铺子要符合这座城的脾性（有的临水多船行，有的近山多山货），不要四家都是茶馆。',\n"
        "      ].join('\\n');\n"
        "      const res = await petService.llmClient.complete({\n"
        "        system: '只输出 JSON 数组，不要解释。',\n"
        "        messages: [{ role: 'user', content: prompt }],\n"
        "        maxTokens: 260,\n"
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
        "      w2.cityShops[city] = true;\n"
        "      w2.places = w2.places || {};\n"
        "      let made = 0;\n"
        "      for (const item of Array.isArray(list) ? list.slice(0, 4) : []) {\n"
        "        const shop = String(item?.shop || '').slice(0, 12);\n"
        "        const who = String(item?.who || '').slice(0, 8);\n"
        "        const kind = String(item?.kind || '铺子').slice(0, 8);\n"
        "        const role = String(item?.role || kind).slice(0, 12);\n"
        "        if (!shop || !who) continue;\n"
        "        if (Object.values(w2.actors).some((a) => a?.name === who)) continue;\n"
        "        w2.flags.placeSeq = (Number(w2.flags.placeSeq) || 0) + 1;\n"
        "        const pid = `place_${w2.flags.placeSeq}`;\n"
        "        w2.places[pid] = { name: `${city}·${shop}`.slice(0, 20), exits: ['street'], dynamic: true, city };\n"
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
        "      saveState(DATA_DIR, w2);\n"
        "      console.log(`[City] ${city} 补出 ${made} 家铺子`);\n"
        "    } catch (err) {\n"
        "      console.warn('[City] 补街市失败：', err.message);\n"
        "    }\n"
        "  }\n\n"
        "  // 朝议：每 5 天由天道下一道旨"
    )
    s2 = s2.replace(anchor2, fn, 1)
    s2 = s2.replace("        await generateDecree();", "        await generateDecree();\n        await generateCityShops();", 1)
    print('wired city shop generation')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
