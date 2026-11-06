import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：婚姻字段收口"
add = """      // 一次性：每城客栈得有个掌柜（不然开房没人应）+ 清掉"付3两"这类脏地点
      try {
        if (!world.flags?.innFixV1) {
          let added = 0;
          for (const [city, b] of Object.entries(world.flags?.cityBase || {})) {
            const innId = b?.innId;
            if (!innId || !world.places?.[innId]) continue;
            const has = Object.values(world.actors || {}).some((a) => a && !a.dead && a.location === innId && /掌柜|伙计|跑堂/.test(String(a.role || '')));
            if (has) continue;
            const used = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
            let nm = '';
            for (let i = 0; i < 20; i += 1) {
              const cand = ['钱', '孙', '李', '周', '吴', '郑', '王', '冯'][Math.floor(Math.random() * 8)] + ['掌柜', '掌柜', '二掌柜'][Math.floor(Math.random() * 3)];
              if (!used.has(cand)) { nm = cand; break; }
            }
            if (!nm) continue;
            const id = `${city.replace(/府$|县$|州$/g, '')}_innkeeper`;
            world.actors[id] = {
              id, name: nm, role: '客栈掌柜', title: '客栈掌柜', gender: 'male',
              age: 38 + Math.floor(Math.random() * 12), home: innId, location: innId,
              money: 12, relations: {}, origin: 'city_base',
            };
            added += 1;
          }
          let removed = 0;
          for (const [pid, pl] of Object.entries(world.places || {})) {
            if (!pl?.name || !/付[\\d一二三四五六七八九十]+两/.test(String(pl.name))) continue;
            const fallback = Array.isArray(pl.exits) && pl.exits.length ? pl.exits[0] : 'street';
            for (const a of Object.values(world.actors || {})) {
              if (a && !a.dead && a.location === pid) a.location = fallback;
            }
            delete world.places[pid];
            removed += 1;
          }
          world.flags = world.flags || {};
          world.flags.innFixV1 = { at: Date.now(), added, removed };
          console.log(`[Inn] 补掌柜 ${added} 城；清脏地点 ${removed} 处`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'innFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('客栈掌柜+脏地点清理')

# 开房动作
p2 = 'src/world/chat-actions.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor2 = "  // 带护院出门：最多 4 人随行"
add2 = """  // 开房住店：按行情收房钱，登记今夜在此歇下
  if (/(开|要|住)(一间|间|个)?(上房|房间|房)|住店/.test(say)) {
    const innId = Object.keys(world.places || {}).find((id) => /客栈/.test(String(world.places[id]?.name || ''))
      && String(world.places[id]?.name || '').startsWith(String(world.places?.[me.location]?.name || '').split('·')[0]));
    const fee = 0.1;
    const purse = Number(world.assets?.silver) || 0;
    if (purse < fee) {
      notices.push(`（上房一晚 ${fee.toFixed(2)} 两，手头不够。）`);
    } else {
      world.assets.silver = Math.round((purse - fee) * 100) / 100;
      world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
      world.ledger.push({ day, hour: world.clock?.hour || 0, delta: -fee, title: '客栈上房', by: 'husband', balance: world.assets.silver });
      world.flags = world.flags || {};
      world.flags.lodging = { place: innId || me.location, day };
      notices.push(`上房开好了，一晚 ${fee.toFixed(2)} 两，今夜就在此处歇下。`);
    }
  }

""" + anchor2
if '开房住店' not in t and anchor2 in t:
    t = t.replace(anchor2, add2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('开房动作')
