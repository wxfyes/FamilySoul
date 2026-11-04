import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const world = peek(DATA_DIR);
      return sendJson(res, 200, { ok: true, result: auditAll(world) });"""
new = """      const world = peek(DATA_DIR);
      const structure = inspectStructure(world);
      return sendJson(res, 200, { ok: true, result: auditAll(world), structure, structureCount: structure.length });"""
if old in s and 'structureCount' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('审计接口带上结构问题')
