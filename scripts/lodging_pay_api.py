import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① /api/me 下发待确认的消费动作
old = """        self: { name: me?.name || '', role: me?.role || '', place: place?.name || '', isHusband },
        here: hereNames,"""
new = """        self: { name: me?.name || '', role: me?.role || '', place: place?.name || '', isHusband },
        here: hereNames,
        pendingAction: world.pendingAction || null,"""
if old in s and 'pendingAction: world.pendingAction' not in s:
    s = s.replace(old, new, 1)
    print('① /api/me 下发 pendingAction')

# ② 开房结算接口
anchor = "    // POST /api/world/summon"
block = r'''    // POST /api/world/pay { kind:'lodging', option:'上房'|'通铺' } → 付钱、进房、清掉待确认
    if (req.method === 'POST' && pathname === '/api/world/pay') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const kind = String(body.kind || 'lodging');
        const option = String(body.option || '上房');
        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const pend = world.pendingAction;

        if (kind !== 'lodging') return sendJson(res, 400, { ok: false, error: '暂时只支持开房' });
        if (!pend || pend.kind !== 'lodging') return sendJson(res, 400, { ok: false, error: '没有待付的账' });

        const price = Number(option === '通铺' ? pend.cheap : pend.luxury) || 0;
        const silver = Number(world.assets?.silver) || 0;
        const canPay = actorId === 'husband' ? silver : (Number(world.wallets?.[actorId]) || 0);
        if (canPay < price) return sendJson(res, 200, { ok: false, error: `钱不够：要 ${price} 两，你只有 ${canPay.toFixed(2)} 两` });

        // 扣钱
        if (actorId === 'husband') world.assets.silver = Math.round((silver - price) * 100) / 100;
        else world.wallets = { ...(world.wallets || {}), [actorId]: Math.round((canPay - price) * 100) / 100 };

        // 造/取房间
        const innId = pend.inn || 'inn';
        const roomId = `${innId}_room`;
        world.places = world.places || {};
        if (!world.places[roomId]) {
          world.places[roomId] = { id: roomId, name: `${world.places[innId]?.name || '临江客栈'}·${option}`, exits: [innId], dynamic: true, private: true };
          world.dynamicPlaces = world.dynamicPlaces || {};
          world.dynamicPlaces[roomId] = world.places[roomId];
        }

        // 进房：她若同行且在场，一起进
        const comers = [];
        me.location = roomId;
        const partnerId = String((world.chatPartners || {})[actorId] || pend.with || '');
        const partner = world.actors?.[partnerId];
        const partyIds = Array.isArray(world.party?.[actorId]) ? world.party[actorId] : [];
        for (const pid of [partnerId, ...partyIds]) {
          const a = world.actors?.[pid];
          if (!a || a.dead || a.id === actorId) continue;
          if (a.location !== innId && a.location !== roomId && !partyIds.includes(a.id)) continue;
          a.location = roomId;
          a.activity = { text: '进房歇息', day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
          comers.push(a.name);
        }

        delete world.pendingAction;
        saveState(DATA_DIR, world);
        const line = `（你付了 ${price} 两，进了「${world.places[roomId].name}」。${comers.length ? comers.join('、') + '也进来了。' : ''}）`;
        console.log(`[Pay] ${option} ${price} 两，进房：${comers.join('、') || '独自'}`);
        return sendJson(res, 200, { ok: true, place: world.places[roomId].name, line, paid: price });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

'''
if '/api/world/pay' not in s:
    s = s.replace(anchor, block + anchor, 1)
    print('② 加开房结算接口')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
