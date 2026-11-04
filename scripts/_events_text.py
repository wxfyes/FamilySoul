import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

s = s.replace("import { buildTimeline } from './world/events-view.js';",
              "import { buildTimeline, eventText } from './world/events-view.js';", 1)

old = """            return readRecentEvents(DATA_DIR, 20).filter(
              (e) => (Number(e?.day) || 0) * 24 + (Number(e?.hour) || 0) <= nowH,
            ).slice(-12);"""
new = """            const evs = readRecentEvents(DATA_DIR, 30).filter(
              (e) => (Number(e?.day) || 0) * 24 + (Number(e?.hour) || 0) <= nowH,
            );
            // 每条都带上人话说明，并合并同一时刻同一件事的重复
            const out = [];
            for (const e of evs) {
              const text = eventText(world, e);
              const prev = out[out.length - 1];
              if (prev && prev.action === e.action && prev.day === e.day && prev.hour === e.hour
                  && (prev.payload?.actorId || '') === (e.payload?.actorId || '')) {
                prev.repeat = (prev.repeat || 1) + 1;
                prev.text = `${text}（×${prev.repeat}）`;
                continue;
              }
              out.push({ ...e, text, repeat: 1 });
            }
            return out.slice(-12);"""
if old in s:
    s = s.replace(old, new, 1)
    print('recentEvents 带人话并合并重复')
io.open(p, 'w', encoding='utf-8-sig').write(s)
