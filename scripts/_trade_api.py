import io

# ============ ③ 盐茶丝买卖接口 + 负载 ============
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'trade.js' not in s:
    s = s.replace("import { roomPriceAt, propertyPriceAt } from './world/pricing.js';",
                  "import { roomPriceAt, propertyPriceAt } from './world/pricing.js';\n"
                  "import { buyGoods, sellGoods, goodsSnapshot } from './world/trade.js';")
    anchor = "    // 0.044 善举：施粥 / 平价粜米（花钱买名声，压民怨）"
    block = '''    // 0.043 商货买卖：盐 / 茶 / 丝 / 铁 / 药（真买真卖，有货有价）
    if (req.method === 'POST' && pathname === '/api/world/trade') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const act = String(body.action || 'buy');
        const city = String(body.city || '');
        const good = String(body.good || '');
        const qty = Number(body.qty) || 0;
        const r = act === 'sell'
          ? sellGoods(world, member.actor || 'husband', { city, good, qty })
          : buyGoods(world, member.actor || 'husband', { city, good, qty });
        if (r.ok) saveState(DATA_DIR, world);
        return sendJson(res, 200, r);
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

''' + anchor
    if '/api/world/trade' not in s:
        s = s.replace(anchor, block, 1)
        print('① 商货买卖接口')

    # 负载：手里的货与行市
    s = s.replace("        market: marketSnapshot(world),",
                  "        market: marketSnapshot(world),\n        goods: goodsSnapshot(world),", 1)
    print('② 负载带货')
io.open(p, 'w', encoding='utf-8-sig').write(s)
