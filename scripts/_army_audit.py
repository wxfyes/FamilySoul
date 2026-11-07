import io
# A. 私兵真人化
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：给相公几件真东西"
add = """      // 一次性：账上私兵落到兵营名册（真人）
      try {
        if (!world.flags?.privateArmyV1) {
          const troops = Number(world.factions?.wangjia?.troops) || 0;
          const have = Object.values(world.actors || {}).filter((a) => a && !a.dead && /私兵/.test(String(a.role || ''))).length;
          const need = Math.max(0, troops - have);
          // 兵营：城里没有就建一处
          let barrackId = Object.keys(world.places || {}).find((id) => /兵营|校场/.test(String(world.places[id]?.name || '')));
          if (!barrackId) {
            world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
            barrackId = `place_${world.flags.placeSeq}`;
            world.places[barrackId] = { id: barrackId, name: '临江·王宅·后营', exits: ['street'], dynamic: true, use: 'barrack' };
            console.log('[Army] 建了后营');
          }
          let made = 0;
          for (let i = 0; i < need; i += 1) {
            const nm = fallbackName(world, 'male');
            if (!nm) break;
            const id = `wangjia_soldier_${Date.now()}_${i}`;
            world.actors[id] = {
              id, name: nm, role: '私兵', title: '私兵', gender: 'male',
              age: 20 + Math.floor(Math.random() * 12),
              home: barrackId, location: barrackId, money: 0.5,
              relations: {}, origin: 'private_army', faction: 'wangjia',
            };
            made += 1;
          }
          world.flags = world.flags || {};
          world.flags.privateArmyV1 = { at: Date.now(), made };
          console.log(`[Army] 私兵落籍：${made} 人（账上 ${troops}）`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'privateArmyV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('A 私兵落籍')

# B. 对账进 perf + 每日审计报告
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("        state: st,\n        chat: globalThis.__chatStats || null,",
              "        state: st,\n        moneyAudit: world.flags?.moneyAudit || null,\n        chat: globalThis.__chatStats || null,", 1)
# 私兵人数进 military
t = t.replace("          houseGuards: (() => { let n = 0; for (const a of Object.values(world.actors || {})) { if (a && !a.dead && a.role === '家丁') n += 1; } return n; })(),",
"""          houseGuards: (() => { let n = 0; for (const a of Object.values(world.actors || {})) { if (a && !a.dead && a.role === '家丁') n += 1; } return n; })(),
          privateArmy: (() => { let n = 0; for (const a of Object.values(world.actors || {})) { if (a && !a.dead && /私兵/.test(String(a.role || ''))) n += 1; } return n; })(),""", 1)
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('B 对账/私兵字段')
