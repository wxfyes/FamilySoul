import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """        if (!pend) return sendJson(res, 200, { ok: false, error: '没有待付的账' });"""
new = """        // 没有天道报的价，也可以自己记一笔（手动付账）
        if (!pend) {
          const amount = Math.max(0.01, Math.round((Number(body.amount) || 0) * 100) / 100);
          const title = String(body.title || '花销').slice(0, 20);
          if (!body.amount) return sendJson(res, 200, { ok: false, error: '没有待付的账' });
          const silver0 = Number(world.assets?.silver) || 0;
          if (silver0 < amount) {
            return sendJson(res, 200, { ok: false, error: `钱不够：要 ${amount} 两，手头 ${silver0.toFixed(2)} 两` });
          }
          world.assets.silver = Math.round((silver0 - amount) * 100) / 100;
          world.notes = Array.isArray(world.notes) ? world.notes : [];
          world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}花了${amount}两：${title}` });
          world.events = Array.isArray(world.events) ? world.events : [];
          world.events.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}花${amount}两${title}` });
          saveState(DATA_DIR, world);
          return sendJson(res, 200, { ok: true, line: `（付了 ${amount} 两：${title}。余 ${world.assets.silver.toFixed(2)} 两）`, paid: amount });
        }"""
if old in s:
    s = s.replace(old, new, 1)
    print('pay 支持手动记账')
io.open(p, 'w', encoding='utf-8-sig').write(s)
