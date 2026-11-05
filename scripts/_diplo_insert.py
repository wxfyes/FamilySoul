import io

p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '0.04 兵权' in l)

block = '''    // 0.045 外交与自立：结盟 / 断交 / 赠礼 / 称制
    if (req.method === 'POST' && pathname === '/api/world/diplomacy') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 64 * 1024);
        const world = loadState(DATA_DIR);
        ensureFactions(world);
        const me = factionOf(world, 'wangjia');
        const other = factionOf(world, String(body.faction || ''));
        if (!me) return sendJson(res, 404, { ok: false, error: '没有这个势力' });
        if (!other && String(body.action || '') !== 'proclaim') {
          return sendJson(res, 404, { ok: false, error: '没有这个势力' });
        }

        const act = String(body.action || '');
        me.relations = me.relations || {};
        let text = '';
        if (act === 'ally') {
          other.relations = other.relations || {};
          me.relations[other.id] = 60;
          other.relations[me.id] = Math.max(50, Number(other.relations[me.id]) || 0);
          text = `${me.name}与${other.name}结为盟好`;
        } else if (act === 'break') {
          other.relations = other.relations || {};
          me.relations[other.id] = -30;
          other.relations[me.id] = -30;
          text = `${me.name}与${other.name}断交`;
        } else if (act === 'gift') {
          const amount = Math.max(1, Number(body.amount) || 0);
          if (!spendFactionSilver(world, me, amount)) return sendJson(res, 200, { ok: false, error: '银不够' });
          other.relations = other.relations || {};
          other.relations[me.id] = Math.min(100, (Number(other.relations[me.id]) || 0) + Math.round(amount / 10));
          text = `${me.name}赠${other.name}${amount}两`;
        } else if (act === 'proclaim') {
          const cities = (me.cities || []).length;
          if (cities < 3) return sendJson(res, 200, { ok: false, error: `至少要据三城才能称制（现有 ${cities} 城）` });
          me.kind = 'warlord';
          me.stance = 'expand';
          me.stateName = String(body.name || '临江').slice(0, 6);
          me.relations.court = -60;
          if (world.factions.court) {
            world.factions.court.relations = world.factions.court.relations || {};
            world.factions.court.relations.wangjia = -60;
          }
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

'''

lines = lines[:idx] + block.split('\n') + lines[idx:]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('外交/自立接口已插入第', idx + 1, '行前')
