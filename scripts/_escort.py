import io
p = 'src/world/chat-actions.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "  return notices;\n}"
add = """
  // 带护院出门：最多 4 人随行
  if (/(带|领|点)\\s*(个|几名|几个)?\\s*(护院|家丁)|(护院|家丁)\\s*(随我|随行|跟我)/.test(say)) {
    const hereName0 = String(world.places?.[me.location]?.name || '');
    const estate0 = hereName0.includes('·') ? hereName0.split('·').slice(0, 2).join('·') : '';
    const guards = Object.values(world.actors || {}).filter((a) => a && !a.dead
      && /护院|家丁/.test(String(a.role || ''))
      && (String(world.places?.[a.location]?.name || '').startsWith(estate0) || a.following === me.id));
    const names = [];
    for (const g of guards.slice(0, 4)) {
      g.following = me.id;
      const mv = moveActor(world, g.id, me.location, 'world', '随主出门');
      if (mv?.ok || g.location === me.location) names.push(g.name);
    }
    notices.push(names.length ? `${names.join('、')}随行在侧。` : '（府里没有可带的护院。）');
  }

  // 护院回府
  if (/(护院|家丁)[^。]{0,4}(回府|回去|回宅|散了)/.test(say) || /让他们回府/.test(say)) {
    const names = [];
    for (const g of Object.values(world.actors || {})) {
      if (!g || g.dead || g.following !== me.id) continue;
      g.following = null;
      const back = g.home || hallOf(world) || g.location;
      const mv = back && world.places?.[back] ? moveActor(world, g.id, back, 'world', '回府守宅') : { ok: false };
      if (mv?.ok) names.push(g.name);
    }
    if (names.length) notices.push(`${names.join('、')}回府去了。`);
  }

  // 剿匪：带出来的人 + 私兵一起打
  if (/(剿匪|打匪|清剿|平匪)/.test(say)) {
    const city = (() => { const seg = String(world.places?.[me.location]?.name || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; })();
    const bt = world.bandits?.[city] || Object.values(world.bandits || {}).find((x) => x && x.city === city);
    const strength = Number(bt?.strength || bt?.power || 0);
    const followers = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.following === me.id && /护院|家丁/.test(String(a.role || '')));
    const troops = Number(world.factions?.wangjia?.troops) || 0;
    if (!bt || strength <= 0) {
      notices.push(`（${city}眼下没有成股的匪患。）`);
    } else {
      const power = followers.length * 4 + Math.min(10, troops * 0.3) + (Number(world.factions?.wangjia?.morale) || 60) / 20;
      const win = Math.random() < power / (power + strength + 1);
      if (win) {
        bt.strength = Math.max(0, Math.round(strength * (0.2 + Math.random() * 0.3)));
        const loot = Math.round((2 + Math.random() * 8) * 100) / 100;
        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + loot) * 100) / 100;
        world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
        world.ledger.push({ day, hour: world.clock?.hour || 0, delta: loot, title: '剿匪缴获', by: 'husband', balance: world.assets.silver });
        notices.push(`匪众被打散，缴获 ${loot.toFixed(2)} 两；带出去的 ${followers.length} 人俱在。`);
      } else {
        const hurt = followers.filter(() => Math.random() < 0.5);
        const died = hurt.filter(() => Math.random() < 0.25);
        for (const d of died) { d.dead = true; d.deathDay = day; d.deathCause = '剿匪阵亡'; d.following = null; }
        for (const h of hurt) { if (!h.dead) { h.woundedUntil = { day: day + 3 }; h.following = null; } }
        notices.push(`匪势凶悍，这趟没讨到好：${hurt.map((x) => x.name).join('、') || '随行'}受伤${died.length ? `，${died.map((x) => x.name).join('、')}没能回来` : ''}。`);
      }
    }
  }

""" + anchor
if '带护院出门：最多 4 人随行' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('护院随行+剿匪')
