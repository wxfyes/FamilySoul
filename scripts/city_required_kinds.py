import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old_start = "      const existing = Object.values(w.places || {})"
old_end = "      const raw = String(res?.text || '');"
start = s.find(old_start)
end = s.find(old_end, start)
if start < 0 or end < 0:
    print('WARN: prompt block not found')
else:
    new_block = (
        "      // 每城标配：青楼、赌坊、客栈、当铺、药铺、米行、酒楼、铁铺、布庄、香烛、糕点、茶馆\n"
        "      const REQUIRED = ['青楼', '赌坊', '客栈', '当铺', '药铺', '米行', '酒楼', '铁铺', '布庄', '香烛', '糕点', '茶馆'];\n"
        "      const cityPlaces = Object.values(w.places || {}).filter((p) => p && String(p.name || '').includes(city));\n"
        "      const haveKinds = new Set(cityPlaces.map((p) => String(p.shopKind || '')));\n"
        "      const haveNames = cityPlaces.map((p) => String(p.name).replace(`${city}·`, ''));\n"
        "      const missing = REQUIRED.filter((k) => !haveKinds.has(k));\n"
        "      const prompt = [\n"
        "        `你是天道，正在铺设${city}的街市。`,\n"
        "        haveNames.length ? `已有：${haveNames.join('、')}。` : '这条街还没有铺子。',\n"
        "        missing.length ? `还缺这些行当：${missing.slice(0, 4).join('、')}——这次就补这几个。` : '标配已齐，补 4 家本地特色。',\n"
        "        '只输出 JSON 数组：[{\"shop\":\"铺名\",\"kind\":\"行当\",\"who\":\"掌柜名\",\"role\":\"掌柜身份\"}]',\n"
        "        'kind 必须用上面给的行当名（如「青楼」「赌坊」「客栈」）。不要重复已有铺子。',\n"
        "      ].join('\\n');\n"
        "      const res = await petService.llmClient.complete({\n"
        "        system: '只输出 JSON 数组，不要解释。',\n"
        "        messages: [{ role: 'user', content: prompt }],\n"
        "        maxTokens: 280,\n"
        "        temperature: 0.95,\n"
        "      });\n"
    )
    s = s[:start] + new_block + s[end:]
    print('rewrote prompt with required kinds')

# 新生成的铺子记下 shopKind，便于下次判断缺什么
s = s.replace(
    "        w2.places[pid] = { name: fullName, exits: ['street'], dynamic: true, city, shopKind: kind };",
    "        w2.places[pid] = { name: fullName, exits: ['street'], dynamic: true, city, shopKind: kind };",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
