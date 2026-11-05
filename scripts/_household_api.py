import io

# 中馈：补欠接口 + 负载字段
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 0.043 商货买卖：盐 / 茶 / 丝 / 铁 / 药（真买真卖，有货有价）"
block = '''    // 0.042 中馈：补发内宅积欠月例
    if (req.method === 'POST' && pathname === '/api/world/household') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        world.assets = world.assets && typeof world.assets === 'object' ? world.assets : {};
        const ar = world.assets.householdArrears || { months: 0, owed: 0 };
        const act = String(body.action || 'pay_arrears');
        if (act !== 'pay_arrears') return sendJson(res, 200, { ok: false, error: '未知动作' });
        if (!(Number(ar.owed) > 0)) return sendJson(res, 200, { ok: false, error: '内宅并不欠月例' });
        const need = Math.round(Number(ar.owed) * 100) / 100;
        const silver = Number(world.assets.silver) || 0;
        if (silver < need) return sendJson(res, 200, { ok: false, error: `银不够：欠 ${need} 两，手头 ${silver.toFixed(2)} 两` });
        world.assets.silver = Math.round((silver - need) * 100) / 100;
        world.assets.householdArrears = { months: 0, owed: 0 };
        for (const a of Object.values(world.actors || {})) {
          if (!a || a.dead || !a.household) continue;
          const rel = a.relations?.husband;
          if (rel) {
            rel.grievance = Math.max(0, Math.round((Number(rel.grievance) || 0) - 10));
            rel.trust = Math.min(100, Math.round((Number(rel.trust) || 50) + 5));
          }
        }
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, text: `补发内宅积欠 ${need} 两，婉儿重掌中馈，家宅复归安泰` });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

''' + anchor
if '/api/world/household' not in s:
    s = s.replace(anchor, block, 1)
    print('① 中馈补欠接口')

# 负载：中馈与家计
s = s.replace("        goods: goodsSnapshot(world),",
              "        goods: goodsSnapshot(world),\n"
              "        household: { allowance: Number(world.assets?.householdAllowance) || 4.0, arrears: world.assets?.householdArrears || { months: 0, owed: 0 }, silver: Number(world.assets?.silver) || 0 },", 1)
print('② 负载带中馈')
io.open(p, 'w', encoding='utf-8-sig').write(s)
