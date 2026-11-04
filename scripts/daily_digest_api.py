import io

# ============ ① 服务端：每人今日动向 ============
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """        pendingAction: world.pendingAction || null,"""
new = """        pendingAction: world.pendingAction || null,
        daily: (() => {
          // 各人今日动向：从最近事件里，按名字归到每个人头上
          try {
            const evs = readRecentEvents(DATA_DIR, 200) || [];
            const today = Number(world.clock?.day) || 1;
            const mine = [];
            for (const a of Object.values(world.actors || {})) {
              if (!a || a.dead || !a.name) continue;
              const isKey = a.household || a.id === 'husband'
                || (world.bonds?.[actorId || 'husband'] && Number(world.bonds[actorId || 'husband'][a.id]?.score) >= 30);
              if (!isKey) continue;
              const lines = evs
                .filter((e) => e && Number(e.day) >= today - 1 && String(e.text || '').includes(a.name))
                .slice(-2)
                .map((e) => String(e.text || '').slice(0, 42));
              if (lines.length) mine.push({ name: a.name, place: world.places?.[a.location]?.name || '', lines });
              if (mine.length >= 10) break;
            }
            return mine;
          } catch { return []; }
        })(),"""
if old in s and 'daily: (() =>' not in s:
    s = s.replace(old, new, 1)
    print('① /api/me 下发各人动向')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
