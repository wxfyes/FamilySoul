import io

# ============ ① 服务端：通用"待付款" + 通用确认接口 ============
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# 把 lodging 专用接口换成通用 confirm（保留 pay 为别名）
old_start = s.find("    // POST /api/world/pay { kind:'lodging', option:'上房'|'通铺' }")
old_end = s.find("    // POST /api/world/summon", old_start)
if old_start < 0 or old_end < 0:
    print('WARN: 找不到 pay 接口块')
else:
    block = r'''    // POST /api/world/confirm { actionId, option } → 确认一笔待付款
    // 开房、买东西、打点、赏钱、聘礼……凡是花银子的，都走这里
    if (req.method === 'POST' && (pathname === '/api/world/confirm' || pathname === '/api/world/pay')) {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const pend = world.pendingAction;

        if (!pend) return sendJson(res, 200, { ok: false, error: '没有待付的账' });
        if (body.actionId && pend.id && String(body.actionId) !== String(pend.id)) {
          return sendJson(res, 200, { ok: false, error: '这笔账已经过时了' });
        }

        // 选哪一档
        const options = Array.isArray(pend.options) ? pend.options : [];
        const opt = options.find((o) => String(o.key || o.label) === String(body.option))
          || options.find((o) => String(o.label) === String(body.option))
          || options[0];
        const price = Number(opt?.price) || 0;

        const silver = actorId === 'husband' ? (Number(world.assets?.silver) || 0) : (Number(world.wallets?.[actorId]) || 0);
        if (silver < price) {
          return sendJson(res, 200, { ok: false, error: `钱不够：要 ${price} 两，手头只有 ${silver.toFixed(2)} 两` });
        }

        // 扣钱
        if (actorId === 'husband') world.assets.silver = Math.round((silver - price) * 100) / 100;
        else world.wallets = { ...(world.wallets || {}), [actorId]: Math.round((silver - price) * 100) / 100 };

        let line = `（付了 ${price} 两。）`;
        const comers = [];

        if (pend.kind === 'lodging') {
          const innId = pend.inn || 'inn';
          const roomName = opt?.label || '上房';
          const roomId = `${innId}_room`;
          world.places = world.places || {};
          if (!world.places[roomId]) {
            world.places[roomId] = {
              id: roomId,
              name: `${world.places[innId]?.name || '临江客栈'}·${roomName}`,
              exits: [innId], dynamic: true, private: true,
            };
            world.dynamicPlaces = world.dynamicPlaces || {};
            world.dynamicPlaces[roomId] = world.places[roomId];
          } else {
            world.places[roomId].name = `${world.places[innId]?.name || '临江客栈'}·${roomName}`;
          }
          me.location = roomId;
          const partnerId = String(pend.with || (world.chatPartners || {})[actorId] || '');
          const partyIds = Array.isArray(world.party?.[actorId]) ? world.party[actorId] : [];
          for (const pid of [partnerId, ...partyIds]) {
            const a = world.actors?.[pid];
            if (!a || a.dead || a.id === actorId) continue;
            if (a.location !== innId && a.location !== roomId && !partyIds.includes(a.id)) continue;
            a.location = roomId;
            a.activity = { text: '进房歇息', day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
            comers.push(a.name);
          }
          line = `（你付了 ${price} 两，进了「${world.places[roomId].name}」。${comers.length ? comers.join('、') + '也进来了。' : ''}）`;
        } else {
          // 其它花销：只记账 + 事件，具体效果交给天道下一轮演
          world.events = world.events || [];
          world.events.push({
            day: world.clock?.day, hour: world.clock?.hour,
            text: `${me?.name || '相公'}${pend.title || '花钱'}：${opt?.label || ''} ${price} 两`,
          });
          line = `（${pend.title || '付了账'}：${opt?.label || ''}，${price} 两。）`;
        }

        delete world.pendingAction;
        saveState(DATA_DIR, world);
        console.log(`[Pay] ${pend.kind} ${opt?.label || ''} ${price} 两 → ${line.slice(0, 40)}`);
        return sendJson(res, 200, { ok: true, line, paid: price, place: world.places?.[me?.location]?.name || '' });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

'''
    s = s[:old_start] + block + s[old_end:]
    print('① 换成通用确认接口（pay 为别名）')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
