import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '0.05 落地第一幕' in l)
block = '''    // 0.04 兵权：募兵 / 买粮 / 围城 / 招降 / 修城（玩家侧）
    if (req.method === 'POST' && pathname.startsWith('/api/world/military')) {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 64 * 1024);
        const world = loadState(DATA_DIR);
        ensureFactions(world);
        const fid = 'wangjia';
        const f = factionOf(world, fid);
        if (!f) return sendJson(res, 404, { ok: false, error: '没有这个势力' });

        const act = String(body.action || '');
        let result = { ok: false, error: '未知动作' };
        if (act === 'recruit') result = recruit(world, fid, Number(body.count) || 0);
        else if (act === 'grain') result = buyGrain(world, fid, Number(body.shi) || 0);
        else if (act === 'siege') result = besiege(world, { attacker: fid, cityName: String(body.city || ''), troops: Number(body.troops) || 0 });
        else if (act === 'bribe') result = bribeCity(world, fid, String(body.city || ''), Number(body.amount) || 0);
        else if (act === 'fortify') result = fortify(world, fid, String(body.city || ''), Number(body.amount) || 200);

        if (result.ok) saveState(DATA_DIR, world);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

'''
lines = lines[:idx] + block.split('\n') + lines[idx:]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('兵权接口已插入到第', idx+1, '行前')
