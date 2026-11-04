import io

# ============ ① pet-service：天道招人改调 hireStaff ============
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("    // 雇人：天道替产业点一个人，引擎把人真正立起来、派到那处去")
end = s.find("    // 习性：相处久了性情会变", start)
if start >= 0 and end > start:
    block = """    // 雇人：天道替产业点一个人（唯一入口 hireStaff）
    try {
      const staffTags = String(reply || '').match(/\\[\\[staff:([^\\]]+)\\]\\]/g);
      if (staffTags && staffTags.length) {
        const wS = loadState(this.dataDir);
        for (const tag of staffTags) {
          const m = /\\[\\[staff:([^|\\]]+)\\|([^|\\]]+)(?:\\|([^\\]]+))?\\]\\]/.exec(tag);
          if (!m) continue;
          const r = hireStaff(wS, { propName: m[1], name: m[2], role: m[3] || '伙计', via: 'dm' });
          if (!r.ok) { console.log(`[Staff] ${r.error}`); continue; }
          console.log(`[Staff] ${r.actor.name} 进 ${r.prop.name} 做${r.actor.role}${r.created ? '（新立）' : ''}`);
        }
        wS.notes = (wS.notes || []).slice(-40);
        saveState(this.dataDir, wS);
        reply = String(reply || '').replace(/\\[\\[staff:[^\\]]+\\]\\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

"""
    s = s[:start] + block + s[end:]
    print('① 天道招人改调 hireStaff')

if 'employment.js' not in s:
    s = s.replace("import { moveActor } from './world/position.js';",
                  "import { moveActor } from './world/position.js';\nimport { hireStaff } from './world/employment.js';", 1)
    print('② 引入 hireStaff')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② audit.js：自检招人改调 hireStaff ============
p2 = 'src/world/audit.js'
t = io.open(p2, encoding='utf-8-sig').read()
start2 = t.find("    if (f?.kind === 'staff') {")
end2 = t.find("    if (f?.kind === 'place') {", start2)
if start2 >= 0 and end2 > start2:
    block2 = """    if (f?.kind === 'staff') {
      const r = hireStaff(world, { propName: f?.who, name: f?.name, role: f?.role || '伙计', via: 'audit' });
      if (r.ok) fixed += 1;
      continue;
    }

"""
    t = t[:start2] + block2 + t[end2:]
    print('③ 自检招人改调 hireStaff')

if 'employment.js' not in t:
    t = t.replace("import { moveActor } from './position.js';",
                  "import { moveActor } from './position.js';\nimport { hireStaff } from './employment.js';", 1)
    print('④ audit 引入 hireStaff')
io.open(p2, 'w', encoding='utf-8-sig').write(t)

# ============ ③ server：管理接口改调 hireStaff ============
p3 = 'src/server.js'
u = io.open(p3, encoding='utf-8-sig').read()
start3 = u.find("    // 雇一个人进某处产业（管理用 / 人工纠错）")
end3 = u.find("    // 删掉误记的产业（管理用）：按名字", start3)
if start3 >= 0 and end3 > start3:
    block3 = """    // 雇一个人进某处产业（管理用 / 人工纠错）—— 走唯一入口 hireStaff
    if (req.method === 'POST' && pathname === '/api/admin/staff/hire') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const r = hireStaff(world, {
          propName: body.prop, name: body.name, role: body.role || '伙计', via: 'admin',
        });
        if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, hired: r.actor.name, role: r.actor.role, prop: r.prop.name, staff: r.prop.staff });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

"""
    u = u[:start3] + block3 + u[end3:]
    print('⑤ 管理接口改调 hireStaff')

if 'employment.js' not in u:
    u = u.replace("import { isPlaceName } from './world/naming.js';",
                  "import { isPlaceName } from './world/naming.js';\nimport { hireStaff } from './world/employment.js';", 1)
    print('⑥ server 引入 hireStaff')
io.open(p3, 'w', encoding='utf-8-sig').write(u)
print('done')
