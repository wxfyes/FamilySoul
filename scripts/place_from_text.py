import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 原话里认地点：只要原话提到世上某处，就用那处（最长匹配）
anchor = "    // 约定没地点时：当场请天道从\"世上已有的地方\"里挑一个（它挑，引擎不猜）"
helper = """    // 原话里提到的地点：约定里写了"雅阁/茶摊/铺子"，就该去那儿，不该随机
    const placeFromText = (world, text) => {
      const t = String(text || '');
      if (!t) return null;
      let best = null;
      for (const [id, pl] of Object.entries(world.places || {})) {
        const nm = String(pl?.name || '');
        if (nm.length < 2) continue;
        if (!t.includes(nm)) continue;
        if (!best || nm.length > best.nm.length) best = { id, nm };
      }
      return best ? best.id : null;
    };

"""
if anchor in s and 'placeFromText' not in s:
    s = s.replace(anchor, helper + anchor, 1)
    print('① 加原话认地点')

# ② askDmForPlace：先认原话，再把当事人位置告诉天道，禁止随机
old = """    const askDmForPlace = async (world, ap) => {
      try {
        if (!llmClient.isReady()) return null;"""
new = """    const askDmForPlace = async (world, ap) => {
      try {
        // 先看原话里有没有现成地点
        const fromText = placeFromText(world, ap?.text);
        if (fromText) {
          ap.place = fromText;
          world.notes = Array.isArray(world.notes) ? world.notes : [];
          world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `与${ap.name || '人'}的约定在「${world.places[fromText].name}」（原话就说的这儿）` });
          return fromText;
        }
        if (!llmClient.isReady()) return null;"""
if old in s:
    s = s.replace(old, new, 1)
    print('② 先认原话再问天道')

# ③ 给天道更多依据：原话 + 当事人此刻在哪 + 不许随机
old2 = """        const usr = [
          `第${world.clock?.day}日 ${world.clock?.hour}时，有一桩约要去赴：`,
          `与${ap.name || '某人'}：${String(ap.text || '').slice(0, 40)}`,
          `世上现有的地方：${places}`,
          '这桩约最合场景是在哪？只回一个上面列表里的地点名。',
        ].join('\\n');"""
new2 = """        const other = Object.values(world.actors || {}).find((a) => a && a.name === ap.name);
        const otherPlace = other ? (world.places?.[other.location]?.name || '') : '';
        const usr = [
          `第${world.clock?.day}日 ${world.clock?.hour}时，有一桩约要去赴：`,
          `与${ap.name || '某人'}（她此刻在「${otherPlace || '不知何处'}」）：${String(ap.text || '').slice(0, 60)}`,
          `世上现有的地方：${places}`,
          '先看这桩事的原话里提到了哪处（比如"雅阁/茶摊/铺子/货栈"）；提到了就用那处。',
          '原话没提，就用当事人此刻所在处，或与这事最相关的铺子。',
          '不许随机挑、不许另起地名。只回一个上面列表里的地点名。',
        ].join('\\n');"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('③ 给足依据并禁止随机')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
