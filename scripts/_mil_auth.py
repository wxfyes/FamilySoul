import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
# 兵事写操作只有家主能做
anchor = "        const act = String(body.action || '');"
if anchor not in s:
    anchor = "        const body = await parseJsonBody(req, 32 * 1024);\n        const world = loadState(DATA_DIR);\n        const fid = 'wangjia';"
    guard = """        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const fid = 'wangjia';
        // 家主鉴权：只有王甯（或该势力首领）能调兵、购粮、募人
        {
          const leader = String(world.factions?.wangjia?.leader || 'husband');
          const who = String(member.actor || 'husband');
          if (who !== leader && who !== 'husband') {
            return sendJson(res, 403, { ok: false, error: '王家私兵由家主掌管，你无权调动。' });
          }
        }"""
    if anchor in s:
        s = s.replace(anchor, guard, 1)
        print('① 兵事接口加家主鉴权')
io.open(p, 'w', encoding='utf-8-sig').write(s)
