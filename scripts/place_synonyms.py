import io

p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  // 「去某城」：城里没有长街就先修一条（不能把人塞进府衙）"
add = (
    "  // 别名：口语里的地方，对上世界里真有的地方（医馆→回春堂药铺 之类）\n"
    "  const SYNONYMS = {\n"
    "    医馆: ['药铺', '药堂', '回春堂', '医'],\n"
    "    药铺: ['回春堂', '药堂'],\n"
    "    药房: ['回春堂', '药铺'],\n"
    "    酒楼: ['酒楼', '大酒楼'],\n"
    "    客栈: ['客栈'],\n"
    "    赌坊: ['赌坊'],\n"
    "    青楼: ['万花楼', '青楼'],\n"
    "    茶坊: ['茶坊', '茶馆'],\n"
    "    茶馆: ['茶坊', '茶馆'],\n"
    "    衙门: ['衙门', '县衙'],\n"
    "    县衙: ['衙门', '县衙'],\n"
    "    书院: ['书院'],\n"
    "    庙: ['城隍庙', '庙'],\n"
    "    庙会: ['城隍庙', '庙'],\n"
    "    当铺: ['当铺'],\n"
    "    铁匠铺: ['铁铺', '铁匠'],\n"
    "  };\n"
    "  if (mentioned.length === 0) {\n"
    "    const asked = Object.keys(SYNONYMS).find((k) => say.includes(k));\n"
    "    if (asked && !Object.values(world.places || {}).some((pl) => String(pl?.name || '').includes(asked))) {\n"
    "      for (const kw of SYNONYMS[asked]) {\n"
    "        const hit = Object.entries(world.places || {}).find(([, pl]) => String(pl?.name || '').includes(kw));\n"
    "        if (hit) {\n"
    "          const [pid, pl] = hit;\n"
    "          if (me.location !== pid) {\n"
    "            me.location = pid;\n"
    "            saveState(dataDir, world);\n"
    "          }\n"
    "          return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: pl.name };\n"
    "        }\n"
    "      }\n"
    "    }\n"
    "  }\n\n"
    "  // 「去某城」：城里没有长街就先修一条（不能把人塞进府衙）"
)
if anchor in s and 'SYNONYMS' not in s:
    s = s.replace(anchor, add, 1)
    print('added place synonyms')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
