import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 站在别人门口说「通禀/求见」：服务端真去叩门，门房的话直接写在回话最前面"
add = """      // 送客：在最后（所有写盘之后）统一结算一次，保证不被后写的旧快照覆盖
      try {
        const farewell = /^(?:你|你们|都|先)?\\s*(?:走|回去吧|回吧|退下|下去|散了|去吧|出门吧|慢走|送客)[。！!~…\\s]*$/.test(String(body.text || '').trim())
          || /送客|你回吧|你走吧|退下吧|都散了吧|都出去/.test(String(body.text || ''));
        if (farewell) {
          const wD = loadState(DATA_DIR);
          const meD = wD.actors?.[String(currentMember.actor || 'husband')] || wD.actors?.husband;
          const here = Object.values(wD.actors || {}).filter((x) => x && !x.dead && x.id !== meD?.id
            && x.location === meD?.location && !x.humanBound && !String(x.id).startsWith('usr_'));
          const cap = /都|你们|大伙|诸位|全/.test(String(body.text || '')) ? 10 : 3;
          const goers = here.filter((x) => !(x.household && meD?.id === 'husband')).slice(0, cap);
          const movedNames = [];
          for (const g of goers) {
            const back = g.quarters || g.home;
            if (!back || !wD.places?.[back] || back === meD.location) continue;
            const mv = moveActor(wD, g.id, back, 'world', '送客离场');
            if (mv?.ok) {
              g.awayUntil = { day: wD.clock?.day || 1, hour: ((Number(wD.clock?.hour) || 0) + 4) % 24 };
              movedNames.push(g.name);
            }
          }
          if (movedNames.length) {
            wD.flags = wD.flags || {};
            wD.flags.stallQuietUntil = { day: wD.clock?.day || 1, hour: ((Number(wD.clock?.hour) || 0) + 3) % 24 };
            saveState(DATA_DIR, wD);
            result.reply.text = String(result.reply.text || '') + `\\n（${movedNames.join('、')}起身告辞，退了出去。）`;
            console.log(`[Departure:出口] ${movedNames.join('、')} 离场`);
          }
        }
      } catch (errD) { console.log('[Departure:出口] 失败：', errD.message); }

""" + anchor
if 'Departure:出口' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 送客挪到出口结算')
