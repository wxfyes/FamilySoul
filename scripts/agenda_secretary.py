import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① menu 的 todos 带上地点与"谁约的"
old = """        const todos = [];
        for (const ap of (world.appointments || [])) {
          if (!ap) continue;
          todos.push({ kind: '约定', id: ap.id || `${ap.day}-${ap.hour}-${ap.name}`, when: `第${ap.day}日${ap.hour}时`, who: ap.name || '', text: ap.text || '', day: ap.day, hour: ap.hour });
        }
        for (const pr of (world.promises || [])) {
          if (!pr || pr.done) continue;
          todos.push({ kind: '承诺', id: pr.id || String(pr.text || '').slice(0, 20), when: `第${pr.due}日`, who: '', text: String(pr.text || '').slice(0, 40), due: pr.due });
        }"""
new = """        const todos = [];
        for (const ap of (world.appointments || [])) {
          if (!ap) continue;
          todos.push({
            kind: '约定', id: ap.id || `${ap.day}-${ap.hour}-${ap.name}`,
            when: `第${ap.day}日${ap.hour}时`, who: ap.name || '',
            text: ap.text || '', day: ap.day, hour: ap.hour,
            place: ap.place || '', placeName: ap.place ? (world.places?.[ap.place]?.name || '') : '',
            overdue: Number(ap.day) * 24 + Number(ap.hour) < (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0),
          });
        }
        for (const pr of (world.promises || [])) {
          if (!pr || pr.done) continue;
          todos.push({
            kind: '承诺', id: pr.id || String(pr.text || '').slice(0, 20),
            when: `第${pr.due}日`, who: '', text: String(pr.text || '').slice(0, 40), due: pr.due,
            place: '', placeName: '', overdue: Number(pr.due) < (Number(world.clock?.day) || 1),
          });
        }
        // 天道最近该知道的事（你的决定会记在这里）
        const brief = (world.notes || []).slice(-8).map((n) => String(n.text || n).slice(0, 60));"""
if old in s:
    s = s.replace(old, new, 1)
    print('① todos 带地点/逾期')

# ② 返回 brief
s = s.replace("          clock: { day: world.clock?.day, hour: world.clock?.hour },",
              "          clock: { day: world.clock?.day, hour: world.clock?.hour },\n          brief,", 1)

# ③ todo 接口：do / drop / later
start = s.find("    // POST /api/world/todo { id, action }")
end = s.find("    // POST /api/admin/actor/delete", start)
if start > 0 and end > start:
    block = r'''    // POST /api/world/todo { id, action: do|drop|later } → 秘书式行程：去做/推掉/改天
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
          if (apt) { apt.day = Number(apt.day) + 1; line = `（改到第${apt.day}日。已记下。）`; }
          else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) { pr.due = Number(pr.due) + 1; line = `（改到第${pr.due}日。已记下。）`; }
            }
          }
          world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}把一件事改天了` });
        } else if (action === 'do') {
          if (apt) {
            const placeName = apt.place ? (world.places?.[apt.place]?.name || '') : '';
            if (apt.place && world.places?.[apt.place]) {
              me.location = apt.place;
              line = `（你去了「${placeName}」赴约。）`;
            } else {
              line = '（这桩约定当初没记下地点，只能先记在心上。）';
            }
            world.appointments = (world.appointments || []).filter((x) => x !== apt);
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}去赴了${apt.name || '人'}的约（${String(apt.text || '').slice(0, 20)}）` });
          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) { pr.done = true; line = '（这件事办了，记下了。）'; }
            }
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}办了一桩旧诺` });
          }
        } else {
          // drop
          if (apt) {
            world.appointments = (world.appointments || []).filter((x) => x !== apt);
            line = '（推了这桩约。）';
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}推掉了${apt.name || '人'}的约（${String(apt.text || '').slice(0, 18)}）` });
            // 被推掉的人会不高兴
            const other = Object.values(world.actors || {}).find((a) => a?.name === apt.name);
            if (other) {
              other.relations = other.relations || {};
              const rel = other.relations.husband || other.relations[actorId] || { trust: 30, desire: 20, grievance: 0 };
              rel.grievance = Math.min(100, Number(rel.grievance || 0) + 6);
              other.relations.husband = rel;
            }
          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) { pr.done = true; pr.dropped = true; line = '（这桩诺言作罢了。）'; }
            }
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}把一桩诺言作罢了` });
          }
        }

        world.notes = world.notes.slice(-40);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, line });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

'''
    s = s[:start] + block + s[end:]
    print('② todo 改为 去做/推掉/改天')
else:
    print('WARN: todo 块没找到')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
