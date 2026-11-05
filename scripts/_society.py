import io

# ① clock：每月士林清议 + 宗族走动
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'reputation.js' not in s:
    s = s.replace("import { runAging } from './aging.js';",
                  "import { runAging } from './aging.js';\nimport { runGentlemenTalk } from './reputation.js';\nimport { runClanVisits } from './clans.js';", 1)
    print('① 引入 reputation/clans')

anchor = """  // 岁时：长岁、及冠、衰朽（每 30 日一次）"""
block = """  // 每月：士林清议、宗族走动（都只说事实，不写台词）
  try {
    runGentlemenTalk(world, events, nextEvent);
    runClanVisits(world, events, nextEvent);
  } catch (err) {
    console.warn('[Society] 清议/宗族结算失败：', err.message);
  }

""" + anchor
if 'runGentlemenTalk(world, events, nextEvent)' not in s:
    s = s.replace(anchor, block, 1)
    print('② 时钟接清议与宗族')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② server：施粥善举 + 自立看名分 + 断交损名
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'reputation.js' not in t:
    t = t.replace("import { marketSnapshot } from './world/prices.js';",
                  "import { marketSnapshot } from './world/prices.js';\n"
                  "import { addFame, fameOf, legitimacy } from './world/reputation.js';\n"
                  "import { ensureClans, clanBacking } from './world/clans.js';")
    print('③ server 引入名声/宗族')

# 外交：断交损名；称制要名分
t = t.replace("""        } else if (act === 'break') {
          other.relations = other.relations || {};
          me.relations[other.id] = -30;
          other.relations[me.id] = -30;
          text = `${me.name}与${other.name}断交`;""",
"""        } else if (act === 'break') {
          other.relations = other.relations || {};
          me.relations[other.id] = -30;
          other.relations[me.id] = -30;
          addFame(world, 'husband', -6, '乱贼');
          text = `${me.name}与${other.name}断交`;""")

t = t.replace("""          if (cities < 3) return sendJson(res, 200, { ok: false, error: `至少要据三城才能称制（现有 ${cities} 城）` });""",
"""          if (cities < 3) return sendJson(res, 200, { ok: false, error: `至少要据三城才能称制（现有 ${cities} 城）` });
          const legit = legitimacy(world, 'husband');
          if (legit < 40) {
            addFame(world, 'husband', -10, '乱贼');
            me.relations.court = -80;
            if (world.factions.court) {
              world.factions.court.relations = world.factions.court.relations || {};
              world.factions.court.relations.wangjia = -80;
            }
            saveState(DATA_DIR, world);
            return sendJson(res, 200, { ok: false, error: `名分不足（${legit}/40），僭号必引天下共讨` });
          }""")

# 新增：施粥善举（花钱买名声，降民怨）
anchor2 = "    // 0.045 外交与自立：结盟 / 断交 / 赠礼 / 称制"
block2 = '''    // 0.044 善举：施粥 / 平价粜米（花钱买名声，压民怨）
    if (req.method === 'POST' && pathname === '/api/world/charity') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const me = world.actors?.[member.actor || 'husband'];
        const amount = Math.max(1, Math.round(Number(body.amount) || 0));
        const city = String(body.city || '临江府');
        if (!world.cities?.[city]) return sendJson(res, 200, { ok: false, error: '没有这座城' });
        if (!spendSilver(world, amount, `施粥·${city}`, member.actor || 'husband').ok) {
          return sendJson(res, 200, { ok: false, error: '银不够' });
        }
        world.cities[city].unrest = Math.max(0, Number(world.cities[city].unrest) - Math.round(amount / 20));
        addFame(world, member.actor || 'husband', Math.min(12, Math.round(amount / 10)), '仁商');
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, text: `在${city}施粥${amount}两，民怨稍平，名声渐起` });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

''' + anchor2
if '/api/world/charity' not in t:
    t = t.replace(anchor2, block2, 1)
    print('④ 加施粥接口')

# 负载：名声与宗族
t = t.replace("        market: marketSnapshot(world),",
              "        market: marketSnapshot(world),\n"
              "        fame: { value: fameOf(world, actorId), tags: (world.actors?.[actorId]?.fame?.tags || []) },\n"
              "        clans: Object.values(world.clans || {}).map((c) => ({ id: c.id, name: c.name, relation: c.relation, influence: c.influence })),", 1)

io.open(p2, 'w', encoding='utf-8-sig').write(t)
