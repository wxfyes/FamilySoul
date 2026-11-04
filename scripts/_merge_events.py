import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            const out = [];
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
new = """            const out = [];
            const index = new Map();
            for (const e of evs) {
              const text = eventText(world, e);
              const key = `${e.day}|${e.hour}|${e.action}|${e.actor}|${e.payload?.actorId || ''}`;
              const hit = index.get(key);
              if (hit) {
                hit.repeat += 1;
                hit.text = `${hit.base}（×${hit.repeat}）`;
                continue;
              }
              const item = { ...e, text, base: text, repeat: 1 };
              index.set(key, item);
              out.push(item);
            }
            return out.slice(-12);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('合并改为按 key 全局合并')
