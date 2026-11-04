import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 引入 loadState 与 applyAction
old_imp = "import { ensureCities, ensureCourt, ensureTerrain, seedPersonalMoney } from './world/state.js';"
new_imp = "import { ensureCities, ensureCourt, ensureTerrain, seedPersonalMoney, loadState } from './world/state.js';\nimport { applyAction } from './world/apply.js';"
if old_imp in s and 'applyAction }' not in s:
    s = s.replace(old_imp, new_imp, 1)
    print('① 引入 loadState / applyAction')

anchor = "    // 9.31b 改世界人物属性 POST /api/admin/actor/set"

block = r'''    // ═══ 交互层：去哪 / 找人 / 约定（只读 + 走同一条管道） ═══

    // GET /api/world/menu  → 一次取回：我在哪、可去的地方、可找的人、待办
    if (req.method === 'GET' && pathname === '/api/world/menu') {
      try {
        const world = peek(DATA_DIR);
        const me = world.actors?.husband;
        const curId = me?.location || 'husband_room';
        const curName = world.places?.[curId]?.name || curId;

        const placeName = (id) => world.places?.[id]?.name || id;
        const people = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== 'husband');

        // 可去的地方：当前出口 + 自有产业 + 有人的地方
        const exits = (world.places?.[curId]?.exits || []).map((id) => ({ id, name: placeName(id) }));
        const props = (world.assets?.properties || []).map((x) => ({ name: x.name, income: x.incomePerDay || 0 }));
        const occupied = {};
        for (const a of people) {
          if (!a.location || !a.name) continue;
          occupied[a.location] = occupied[a.location] || [];
          if (occupied[a.location].length < 4) occupied[a.location].push(a.name);
        }
        const places = Object.entries(occupied)
          .map(([id, names]) => ({ id, name: placeName(id), names }))
          .filter((x) => x.id !== curId)
          .sort((x, y) => y.names.length - x.names.length)
          .slice(0, 12);

        // 可找的人：府内 / 相好 / 其他
        const rel = (a) => a.relations?.husband || {};
        const isIntimate = (a) => (a.intimacy && a.intimacy.consummated) || Number(rel(a).trust) >= 60;
        const group = (a) => (a.household ? '府内' : isIntimate(a) ? '相好' : '其他人');
        const peopleOut = people
          .map((a) => ({
            id: a.id, name: a.name, role: a.role || '', place: placeName(a.location || ''),
            here: a.location === curId, group: group(a),
            trust: Number(rel(a).trust) || 0, grievance: Number(rel(a).grievance) || 0,
          }))
          .sort((x, y) => {
            const o = { 府内: 0, 相好: 1, 其他人: 2 };
            if (o[x.group] !== o[y.group]) return o[x.group] - o[y.group];
            return y.trust - x.trust;
          })
          .slice(0, 40);

        // 待办：约定 + 承诺
        const todos = [];
        for (const ap of (world.appointments || [])) {
          if (!ap) continue;
          todos.push({ kind: '约定', id: ap.id || `${ap.day}-${ap.hour}-${ap.name}`, when: `第${ap.day}日${ap.hour}时`, who: ap.name || '', text: ap.text || '', day: ap.day, hour: ap.hour });
        }
        for (const pr of (world.promises || [])) {
          if (!pr || pr.done) continue;
          todos.push({ kind: '承诺', id: pr.id || String(pr.text || '').slice(0, 20), when: `第${pr.due}日`, who: '', text: String(pr.text || '').slice(0, 40), due: pr.due });
        }

        return sendJson(res, 200, {
          ok: true,
          where: { id: curId, name: curName },
          places, homes: props, people: peopleOut, todos,
          clock: { day: world.clock?.day, hour: world.clock?.hour },
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // POST /api/world/go { place }  → 我去某处（走 applyAction，单一写者）
    if (req.method === 'POST' && pathname === '/api/world/go') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const target = String(body.place || '').trim();
        if (!target) return sendJson(res, 400, { ok: false, error: '没说要哪儿' });
        const world = loadState(DATA_DIR);
        const hit = Object.entries(world.places || {}).find(([id, p]) => p?.name === target || id === target);
        const intent = {
          id: `ui_go_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          actor: 'husband', verb: 'MOVE', target, companions: [],
          params: { byUi: true }, origin: 'ui',
        };
        const res2 = applyAction({ dataDir: DATA_DIR, world, intent, verdict: { companionConsented: true } });
        const after = peek(DATA_DIR);
        const me = after.actors?.husband;
        return sendJson(res, 200, {
          ok: true, applied: Boolean(res2.applied),
          place: after.places?.[me?.location]?.name || me?.location || '',
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // POST /api/world/summon { id }  → 叫她过来（她走到我这）
    if (req.method === 'POST' && pathname === '/api/world/summon') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const id = String(body.id || '');
        const world = loadState(DATA_DIR);
        const me = world.actors?.husband;
        const her = world.actors?.[id];
        if (!her || her.dead) return sendJson(res, 404, { ok: false, error: '没有这个人' });
        const hereName = world.places?.[me?.location]?.name || '';
        const intent = {
          id: `ui_come_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          actor: id, verb: 'MOVE', target: hereName, companions: [],
          params: { byUi: true, summonedBy: 'husband' }, origin: 'ui',
        };
        const r = applyAction({ dataDir: DATA_DIR, world, intent, verdict: { companionConsented: true } });
        const after = peek(DATA_DIR);
        return sendJson(res, 200, { ok: true, applied: Boolean(r.applied), place: after.places?.[after.actors?.[id]?.location]?.name || '' });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // POST /api/world/todo { id, action }  → drop / done / go
    if (req.method === 'POST' && pathname === '/api/world/todo') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const id = String(body.id || '');
        const action = String(body.action || 'done');
        let touched = false;

        if (action === 'go') {
          const ap = (world.appointments || []).find((x) => x && (x.id === id || `${x.day}-${x.hour}-${x.name}` === id));
          if (ap) {
            const where = String(ap.place || ap.text || '').match(/(?:城|府|县|街|巷|楼|馆|铺|阁|茶坊|茶摊|码头|庄子|别院)/) ? '' : '';
            const targetName = where || 'street';
            const intent = {
              id: `ui_apt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              actor: 'husband', verb: 'MOVE', target: '青石板长街', companions: [], params: { byUi: true }, origin: 'ui',
            };
            applyAction({ dataDir: DATA_DIR, world, intent, verdict: { companionConsented: true } });
            touched = true;
          }
        } else if (action === 'drop' || action === 'done') {
          const beforeA = (world.appointments || []).length;
          world.appointments = (world.appointments || []).filter(
            (x) => x && x.id !== id && `${x.day}-${x.hour}-${x.name}` !== id,
          );
          const beforeP = (world.promises || []).length;
          world.promises = (world.promises || []).map((x) => {
            if (!x) return x;
            const key = x.id || String(x.text || '').slice(0, 20);
            if (key === id) { x.done = true; return x; }
            return x;
          });
          saveState(DATA_DIR, world);
          touched = (world.appointments || []).length !== beforeA || beforeP >= 0;
        }
        return sendJson(res, 200, { ok: true, touched });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

'''

if '/api/world/menu' not in s:
    s = s.replace(anchor, block + anchor, 1)
    print('② 已加交互层接口（menu / go / summon / todo）')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
