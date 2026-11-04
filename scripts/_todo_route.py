import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

# 找 todo 路由起点（注释行）
start = None
for i, l in enumerate(lines):
    if "// POST /api/world/todo" in l:
        start = i
        break
if start is None:
    print('WARN: 找不到 todo 注释')

# 找它的结束：下一个顶层注释 "    // " 且不是本块内
end = None
for j in range(start + 1, len(lines)):
    if lines[j].startswith('    // ') and j > start + 3:
        end = j
        break
print('todo 块:', start + 1, '→', (end or 0) + 1)

block = r'''    // POST /api/world/todo { id, action: do|drop|later } → 秘书式行程
    if (req.method === 'POST' && pathname === '/api/world/todo') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const id = String(body.id || '');
        const action = String(body.action || 'done');
        world.notes = Array.isArray(world.notes) ? world.notes : [];
        const apt = (world.appointments || []).find((x) => x && (x.id === id || `${x.day}-${x.hour}-${x.name}` === id));
        let line = '';

        if (action === 'later') {
          if (apt) { apt.day = Number(apt.day) + 1; line = `（改到第${apt.day}日，记下了。）`; }
          else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) { pr.due = Number(pr.due) + 1; line = `（改到第${pr.due}日，记下了。）`; }
            }
          }
          world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}把一件事改天了` });
        } else if (action === 'do') {
          if (apt) {
            if (apt.place && world.places?.[apt.place]) {
              me.location = apt.place;
              line = `（你去了「${world.places[apt.place].name}」赴约。）`;
            } else {
              line = '（这桩约当初没记地点，先记在心上。）';
            }
            world.appointments = (world.appointments || []).filter((x) => x !== apt);
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}去赴了${apt.name || '人'}的约` });
          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) { pr.done = true; line = '（这件事办了，记下了。）'; }
            }
          }
        } else {
          if (apt) {
            world.appointments = (world.appointments || []).filter((x) => x !== apt);
            line = '（推了这桩约。）';
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}推掉了${apt.name || '人'}的约` });
            const other = Object.values(world.actors || {}).find((a) => a?.name === apt.name);
            if (other) {
              other.relations = other.relations || {};
              const rel = other.relations.husband || { trust: 30, desire: 20, grievance: 0 };
              rel.grievance = Math.min(100, Number(rel.grievance || 0) + 6);
              other.relations.husband = rel;
            }
          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) { pr.done = true; pr.dropped = true; line = '（这桩诺言作罢了。）'; }
            }
          }
        }

        world.notes = world.notes.slice(-40);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, line });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

'''.split('\n')

lines = lines[:start] + block + lines[end:]
io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('已替换 todo 路由')
