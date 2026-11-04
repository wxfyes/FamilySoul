import io

# ① 造物验名：加入方位/指示类假地名黑名单
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          const valid = /^[\\u4e00-\\u9fa5]{2,6}$/.test(rawName)
            && !/(什么|哪|这里|那里|某|一个|怎么|如何|是否|到底)/.test(rawName)
            && !/(去|来|走|到|找|说|看)/.test(rawName);"""
new = """          const valid = /^[\\u4e00-\\u9fa5]{2,6}$/.test(rawName)
            && !/(什么|哪|这里|那里|某|一个|怎么|如何|是否|到底)/.test(rawName)
            && !/(去|来|走|到|找|说|看|上|下|里|外|前|后|旁|中|间|边)/.test(rawName.slice(0, 1))
            && !/^(上方|下方|上面|下面|左边|右边|旁边|中间|里头|外头|前面|后面|里面|外面|这里|那里|上头|下头)$/.test(rawName);"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 造物验名加方位词黑名单')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 加"删产业"管理接口
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "    // 删掉误立的地方，把人送回一处（管理用）"
block = """    // 删掉误记的产业（管理用）：按名字
    if (req.method === 'POST' && pathname === '/api/admin/property/delete') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const name = String(body.name || '').trim();
        const world = loadState(DATA_DIR);
        const before = (world.assets?.properties || []).length;
        world.assets = world.assets || {};
        world.assets.properties = (world.assets.properties || []).filter((x) => x && String(x.name) !== name);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, removed: before - world.assets.properties.length, left: world.assets.properties.length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

"""
if '/api/admin/property/delete' not in t:
    t = t.replace(anchor, block + anchor, 1)
    print('② 加删产业接口')
io.open(p2, 'w', encoding='utf-8').write(t)
print('done')
