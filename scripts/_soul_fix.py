import io
# A. 明确"让某人回家/回铺子/出去"——按名字真搬人
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.85 相公说\"进你屋里/去你房间\""
add = """    // 8.83 相公点名让谁去某处（"让紫嫣回家""叫小翠回房"）：真搬
    try {
      const mGo = /(?:让|叫|命|打发|请)\\s*([\\u4e00-\\u9fa5]{2,4})\\s*(?:先)?\\s*(回家|回去|回房|回屋|回府|回铺子|去铺子|回院子|出去|退下)/.exec(String(sayText || ''));
      if (mGo) {
        const whoName = mGo[1];
        const where = mGo[2];
        const wG = loadState(this.dataDir);
        const who = Object.values(wG.actors || {}).find((a) => a && !a.dead && a.name === whoName);
        if (who) {
          let dest = null;
          if (/铺子/.test(where)) {
            const prop = (wG.assets?.properties || []).find((x) => x && (String(x.keeper || '') === String(who.id) || String(x.owner || '') === String(who.id)) && x.place);
            dest = prop?.place || null;
          }
          if (!dest) dest = who.quarters || who.home || null;
          if (!dest || !wG.places?.[dest]) {
            try { dest = ensureDwelling(wG, who.id, who.name, 'street'); } catch { dest = null; }
          }
          if (dest && wG.places?.[dest] && dest !== who.location) {
            const mv = moveActor(wG, who.id, dest, 'world', '送客离场');
            if (mv?.ok) {
              saveState(this.dataDir, wG);
              reply = `（${who.name}应了一声，起身往${wG.places[dest].name}去了。）\\n` + String(reply || '');
              console.log(`[Departure] 点名离场：${who.name} → ${wG.places[dest].name}`);
            } else {
              console.log(`[Departure] ${who.name} 没走成：${mv?.error}`);
            }
          }
        }
      }
    } catch (err) { console.warn('[Departure] 点名离场失败：', err.message); }

""" + anchor
if '点名离场' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('A 点名送客')

# B. 作息放宽：家眷白天不锁房间，只在夜里回房
p2 = 'src/world/room-life.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """  // 门房当值：白天守大门，夜里回下房"""
new2 = """  // 主人家眷白天不锁死在屋里：只有夜里（21 时后）才回房，白天随她在府里走动
  const isHousehold = Boolean(actor.household);
  const hh = num(hour);
  if (isHousehold && hh >= 8 && hh < 21) {
    const home = world?.places?.[actor.home];
    if (home && actor.location && String(world.places?.[actor.location]?.parent || '') === String(home.id)) return null;
  }

  // 门房当值：白天守大门，夜里回下房"""
if old2 in t and '不锁死' not in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('B 家眷白天自由')
