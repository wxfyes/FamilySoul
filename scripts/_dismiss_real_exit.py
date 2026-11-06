import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
# 在真出口（4092 ChatTotal 之前）插入送客结算
idx = next(i for i, l in enumerate(lines) if 'ChatTotal' in l and '服务端总耗时' in l)
block = '''      // 送客（真出口，所有写盘之后）：把在场该走的人送到他们自己的住处
      try {
        const txtD = String(body.text || '');
        const farewell = /^(?:你|你们|都|先)?\\s*(?:走|回去吧|回吧|退下|下去|散了|去吧|出门吧|慢走|送客)[。！!~…\\s]*$/.test(txtD.trim())
          || /送客|你回吧|你走吧|退下吧|都散了吧|都出去/.test(txtD);
        if (farewell) {
          const wD = loadState(DATA_DIR);
          const meD = wD.actors?.[String(currentMember.actor || 'husband')] || wD.actors?.husband;
          const hereD = Object.values(wD.actors || {}).filter((x) => x && !x.dead && x.id !== meD?.id
            && x.location === meD?.location && !x.humanBound && !String(x.id).startsWith('usr_'));
          const cap = /都|你们|大伙|诸位|全/.test(txtD) ? 10 : 3;
          const goers = hereD.filter((x) => !(x.household && meD?.id === 'husband')).slice(0, cap);
          const movedD = [];
          for (const g of goers) {
            let back = g.quarters || g.home;
            const bad = !back || !wD.places?.[back] || back === 'street' || back === meD?.location;
            if (bad) { try { back = ensureDwelling(wD, g.id, g.name, 'street'); } catch { back = null; } }
            if (!back || !wD.places?.[back] || back === meD?.location) continue;
            const mv = moveActor(wD, g.id, back, 'world', '送客离场');
            if (mv?.ok) { g.awayUntil = { day: wD.clock?.day || 1, hour: ((Number(wD.clock?.hour) || 0) + 4) % 24 }; movedD.push(g.name); }
          }
          if (movedD.length) {
            wD.flags = wD.flags || {};
            wD.flags.stallQuietUntil = { day: wD.clock?.day || 1, hour: ((Number(wD.clock?.hour) || 0) + 3) % 24 };
            saveState(DATA_DIR, wD);
            result.reply.text = String(result.reply.text || '') + `\\n（${movedD.join('、')}起身告辞，退了出去。）`;
            console.log(`[Departure] ${movedD.join('、')} 离场（出口结算）`);
          }
        }
      } catch (errD) { console.log('[Departure] 出口结算失败：', errD.message); }

'''
lines.insert(idx, block)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('插入到真出口，行', idx+1)
