import io

# ============ 修 ③ 天道 besiege 死锁：没驻军就自动开拔（转 march） ============
p = 'src/world/strategy.js'
s = io.open(p, encoding='utf-8-sig').read()

# prompt 里补上 march
old_prompt = "'{\"faction\":\"势力id\",\"action\":\"recruit|buy_grain|besiege|bribe|fortify|hold\",\"target\":\"城名或空\",\"amount\":数字,\"reason\":\"一句话理由\"}',"
new_prompt = "'{\"faction\":\"势力id\",\"action\":\"recruit|buy_grain|march|besiege|bribe|fortify|hold\",\"target\":\"城名或空\",\"amount\":数字,\"reason\":\"一句话理由\"}',"
if old_prompt in s:
    s = s.replace(old_prompt, new_prompt, 1)
    print('① prompt 补 march')

old_besiege = "    else if (action === 'besiege') r = besiege(world, { attacker: fid, cityName: target, troops: amount });"
new_besiege = """    else if (action === 'besiege') {
      // 天道说"打这座城"，但兵还在别处：引擎先让它开拔过去，而不是驳回
      const here = troopsAt(world, f, target);
      if (here < 1) {
        const from = Object.entries(f.stationed || {})
          .sort((a, b) => num(b[1]) - num(a[1]))[0]?.[0];
        if (from) {
          const sendTroops = Math.max(1, Math.min(amount, Math.round(num(f.stationed[from]) * 0.8)));
          const mv = march(world, fid, from, target, sendTroops);
          r = mv.ok
            ? { ok: true, text: `${f.name}自${from}发兵 ${mv.troops}，${mv.days}日可至${target}` }
            : { ok: false, error: mv.error };
        } else {
          r = { ok: false, error: '无兵可派' };
        }
      } else {
        r = besiege(world, { attacker: fid, cityName: target, troops: amount });
      }
    }"""
if old_besiege in s:
    s = s.replace(old_besiege, new_besiege, 1)
    print('② besiege 自动转行军')

io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ 修 ④ 推演双跑：规则推演只在无 LLM 时兜底 ============
p2 = 'src/world/clock.js'
c = io.open(p2, encoding='utf-8-sig').read()
old_rule = """  // 每 7 日：无人指挥的势力自己动（有 LLM 时由 server 侧接管，这里兜底）
  try {
    const day = Number(world.clock?.day) || 1;
    if (day % 7 === 0) {
      npcStrategyTurn(world, events, (w, ev) => {"""
new_rule = """  // 每 7 日：无人指挥的势力自己动
  // 有天道时由 server 侧跑 LLM 推演（flags.strategyByLLM 标记），这里只做兜底，绝不双跑
  try {
    const day = Number(world.clock?.day) || 1;
    if (day % 7 === 0 && !world.flags?.strategyByLLM) {
      npcStrategyTurn(world, events, (w, ev) => {"""
if old_rule in c:
    c = c.replace(old_rule, new_rule, 1)
    print('③ 规则推演只在无 LLM 时跑')
io.open(p2, 'w', encoding='utf-8-sig').write(c)

# server：跑完 LLM 推演后打标记
p3 = 'src/server.js'
d = io.open(p3, encoding='utf-8-sig').read()
old_srv = """            if (petService.llmClient?.isReady?.()) {
              const { system, user } = buildStrategyPrompt(w0);"""
new_srv = """            if (petService.llmClient?.isReady?.()) {
              w0.flags = w0.flags || {};
              w0.flags.strategyByLLM = true;   // 今天这套由天道驱动，时钟不再跑规则推演
              const { system, user } = buildStrategyPrompt(w0);"""
if old_srv in d:
    d = d.replace(old_srv, new_srv, 1)
    print('④ 天道推演打标记')
io.open(p3, 'w', encoding='utf-8-sig').write(d)
