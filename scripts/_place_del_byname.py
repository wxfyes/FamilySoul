import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const id = String(body.id || '');
        const to = String(body.to || 'street');
        const world = loadState(DATA_DIR);
        if (!world.places?.[id]) return sendJson(res, 404, { ok: false, error: '没有这个地点' });"""
new = """        let id = String(body.id || '');
        const wantName = String(body.name || '');
        const to = String(body.to || 'street');
        const world = loadState(DATA_DIR);
        if (!id && wantName) {
          const hit = Object.entries(world.places || {}).find(([, pl]) => pl && String(pl.name) === wantName);
          if (hit) id = hit[0];
        }
        if (!world.places?.[id]) return sendJson(res, 404, { ok: false, error: '没有这个地点' });"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('删地点支持按名字')
