import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (body.jailed !== undefined) {"""
new = """        // 婚配：给谁当配偶（双向写，避免一边有一边没有）
        if (body.spouse !== undefined) {
          const sid = body.spouse ? String(body.spouse) : null;
          if (sid && !world.actors?.[sid]) return sendJson(res, 400, { ok: false, error: '没有这个配偶' });
          if (a.spouse && world.actors?.[a.spouse] && world.actors[a.spouse].spouse === a.id) {
            world.actors[a.spouse].spouse = null;   // 解开旧的一对
          }
          a.spouse = sid;
          if (sid) {
            world.actors[sid].spouse = a.id;
            if (!world.actors[sid].marital) world.actors[sid].marital = 'married';
          }
          changed.spouse = sid ? (world.actors[sid].name || sid) : null;
        }
        if (body.marital != null) { a.marital = String(body.marital); changed.marital = a.marital; }
        if (body.jailed !== undefined) {"""
if old in s and 'body.spouse' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('actor/set 支持配偶与婚配')
