import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("    if (req.method === 'POST' && pathname === '/api/admin/actor/rename') {")
end = s.find("    // 9.34", start)
if start < 0:
    print('WARN: 找不到改名接口')
else:
    if end < 0:
        # 找下一个同级路由结束
        end = s.find("    if (req.method === 'POST' && pathname === '/api/admin/", start + 100)
    block = '''    if (req.method === 'POST' && pathname === '/api/admin/actor/rename') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = loadState(DATA_DIR);
        const r = renameActor(world, String(body.id || '').trim(), String(body.name || ''), { by: 'husband' });
        if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, from: r.from, to: r.to, touched: r.touched || 0 });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

'''
    s = s[:start] + block + s[end:]
    print('已换成 identity.renameActor')

if 'identity.js' not in s:
    s = s.replace("import { hireStaff } from './world/employment.js';",
                  "import { hireStaff } from './world/employment.js';\nimport { renameActor, syncNames } from './world/identity.js';", 1)
    print('引入 identity')
io.open(p, 'w', encoding='utf-8-sig').write(s)
