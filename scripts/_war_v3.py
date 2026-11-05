import io

# ============ ① clock.js：大事自动变成市井谣言（信息流） ============
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'addRumor' not in s:
    s = s.replace("import { spreadRumors } from './rumors.js';",
                  "import { spreadRumors, addRumor } from './rumors.js';", 1)
    print('① 引入 addRumor')

anchor = "  // 枭雄自生：民怨高的城会有人竖旗（规则触发，不写剧本）"
block = """  // 大事化成市井风闻：打仗、破城、灾荒、民变，都会被人传
  try {
    for (const ev of (events || [])) {
      const act = String(ev?.action || '');
      if (!['city_taken', 'siege_failed', 'warlord_spawn', 'revolt', 'disaster', 'treasury_empty', 'relief_short'].includes(act)) continue;
      const text = String(ev?.payload?.text || '').slice(0, 40);
      if (text) addRumor(world, { text, about: [], tone: act === 'city_taken' ? -1 : 0, weight: 4 });
    }
  } catch { /* 忽略 */ }

""" + anchor
if '大事化成市井风闻' not in s:
    s = s.replace(anchor, block, 1)
    print('② 大事转风闻')

io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② server.js：兵权接口扩展 + 外交/自立 ============
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { recruit, buyGrain, besiege, bribeCity, fortify } from './world/warfare.js';",
              "import { recruit, buyGrain, besiege, bribeCity, fortify, march, stationTroops, transferPropertyGrain, troopsAt, totalTroops } from './world/warfare.js';")

old = """        if (act === 'recruit') result = recruit(world, fid, Number(body.count) || 0);
        else if (act === 'grain') result = buyGrain(world, fid, Number(body.shi) || 0);
        else if (act === 'siege') result = besiege(world, { attacker: fid, cityName: String(body.city || ''), troops: Number(body.troops) || 0 });
        else if (act === 'bribe') result = bribeCity(world, fid, String(body.city || ''), Number(body.amount) || 0);
        else if (act === 'fortify') result = fortify(world, fid, String(body.city || ''), Number(body.amount) || 200);"""
new = """        if (act === 'recruit') result = recruit(world, fid, Number(body.count) || 0, String(body.city || ''));
        else if (act === 'grain') result = buyGrain(world, fid, Number(body.shi) || 0, String(body.city || ''));
        else if (act === 'siege') result = besiege(world, { attacker: fid, cityName: String(body.city || ''), troops: Number(body.troops) || 0 });
        else if (act === 'bribe') result = bribeCity(world, fid, String(body.city || ''), Number(body.amount) || 0);
        else if (act === 'fortify') result = fortify(world, fid, String(body.city || ''), Number(body.amount) || 200);
        else if (act === 'march') result = march(world, fid, String(body.from || ''), String(body.city || ''), Number(body.troops) || 0);
        else if (act === 'station') result = stationTroops(world, fid, String(body.from || ''), String(body.city || ''), Number(body.troops) || 0);
        else if (act === 'transfer') result = transferPropertyGrain(world, fid, String(body.prop || ''), String(body.city || ''), Number(body.shi) || 0);
        else if (act === 'army') result = { ok: true, troops: totalTroops(world, factionOf(world, fid)), stationed: factionOf(world, fid)?.stationed || {} };"""
if old in t:
    t = t.replace(old, new, 1)
    print('③ 兵权接口扩展')

# 外交 + 自立：新接口
anchor2 = "    // 0.05 落地第一幕：新人进世界，天道主动开口（只生成一次）"
block2 = '''    // 0.045 外交与自立：结盟 / 断交 / 赠礼 / 称制
    if (req.method === 'POST' && pathname === '/api/world/diplomacy') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 64 * 1024);
        const world = loadState(DATA_DIR);
        ensureFactions(world);
        const me = factionOf(world, 'wangjia');
        const other = factionOf(world, String(body.faction || ''));
        if (!me || !other) return sendJson(res, 404, { ok: false, error: '没有这个势力' });

        const act = String(body.action || '');
        me.relations = me.relations || {};
        other.relations = other.relations || {};
        let text = '';
        if (act === 'ally') {
          me.relations[other.id] = 60;
          other.relations[me.id] = Math.max(50, Number(other.relations[me.id]) || 0);
          text = `${me.name}与${other.name}结为盟好`;
        } else if (act === 'break') {
          me.relations[other.id] = -30;
          other.relations[me.id] = -30;
          text = `${me.name}与${other.name}断交`;
        } else if (act === 'gift') {
          const amount = Math.max(1, Number(body.amount) || 0);
          if (!spendFactionSilver(world, me, amount)) return sendJson(res, 200, { ok: false, error: '银不够' });
          other.relations[me.id] = Math.min(100, (Number(other.relations[me.id]) || 0) + Math.round(amount / 10));
          text = `${me.name}赠${other.name}${amount}两`;
        } else if (act === 'proclaim') {
          const cities = (me.cities || []).length;
          if (cities < 3) return sendJson(res, 200, { ok: false, error: `至少要据三城才能称制（现有 ${cities} 城）` });
          me.kind = 'warlord';
          me.stance = 'expand';
          me.stateName = String(body.name || '临江').slice(0, 6);
          me.relations.court = -60;
          if (world.factions.court) world.factions.court.relations.wangjia = -60;
          text = `${me.name}据${cities}城，称制建国，号「${me.stateName}」`;
        } else {
          return sendJson(res, 200, { ok: false, error: '未知动作' });
        }
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, text });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

''' + anchor2
if '/api/world/diplomacy' not in t:
    t = t.replace(anchor2, block2, 1)
    print('④ 外交与自立接口')

io.open(p2, 'w', encoding='utf-8-sig').write(t)
