import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① menu：按请求者身份解析"我"
old = """    if (req.method === 'GET' && pathname === '/api/world/menu') {
      try {
        const world = peek(DATA_DIR);
        const me = world.actors?.husband;
        const curId = me?.location || 'husband_room';"""
new = """    if (req.method === 'GET' && pathname === '/api/world/menu') {
      try {
        const world = peek(DATA_DIR);
        // 谁在请求，就以谁的身份看世界（她的号看她的位置）
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const curId = me?.location || 'husband_room';"""
if old in s:
    s = s.replace(old, new, 1)
    print('① menu 按请求者解析')

# menu 里"除我之外"的判断：把硬编码 husband 换掉
s = s.replace("const people = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== 'husband');",
              "const people = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== actorId);", 1)
s = s.replace("const rel = (a) => a.relations?.husband || {};",
              "const rel = (a) => a.relations?.husband || {};", 1)
# 排序里"府内"以当前人为准：若请求者不是相公，他自己的府内逻辑仍按 household
print('② people 排除自己')

# ② go：以请求者身份移动
old2 = """        const world = loadState(DATA_DIR);
        const hit = Object.entries(world.places || {}).find(([id, p]) => p?.name === target || id === target);
        const intent = {
          id: `ui_go_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          actor: 'husband', verb: 'MOVE', target, companions: [],
          params: { byUi: true }, origin: 'ui',
        };"""
new2 = """        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const intent = {
          id: `ui_go_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          actor: actorId, verb: 'MOVE', target, companions: [],
          params: { byUi: true }, origin: 'ui',
        };"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('③ go 以请求者身份移动')

# ③ summon：叫到"我这里"
old3 = """        const world = loadState(DATA_DIR);
        const me = world.actors?.husband;
        const her = world.actors?.[id];
        if (!her || her.dead) return sendJson(res, 404, { ok: false, error: '没有这个人' });
        const hereName = world.places?.[me?.location]?.name || '';"""
new3 = """        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const her = world.actors?.[id];
        if (!her || her.dead) return sendJson(res, 404, { ok: false, error: '没有这个人' });
        const hereName = world.places?.[me?.location]?.name || '';"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('④ summon 以请求者位置为准')

# ④ todo go：以请求者身份走
s = s.replace("""              actor: 'husband', verb: 'MOVE', target: '青石板长街', companions: [], params: { byUi: true }, origin: 'ui',""",
              """              actor: (resolveMember(req, url)?.actor || 'husband'), verb: 'MOVE', target: '青石板长街', companions: [], params: { byUi: true }, origin: 'ui',""", 1)
print('⑤ todo 赴约以请求者身份')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
