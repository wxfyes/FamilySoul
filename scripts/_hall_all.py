import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.7851 \"就按你说的办\""
add = """    // 8.7845 都到议事厅：当差的和外客全去厅上，内眷不动
    try {
      const sayH = String(sayText || '');
      if (/(都|全|所有人|你们)[^。]{0,6}(到|去)[^。]{0,4}(议事厅|厅上|前厅)/.test(sayH)) {
        const wH = loadState(this.dataDir);
        const meH = wH.actors?.[this._viewerActorId || 'husband'] || wH.actors?.husband;
        const hallId = Object.keys(wH.places || {}).find((id) => /议事厅/.test(String(wH.places[id]?.name || '')));
        const names = [];
        if (hallId) {
          for (const a of Object.values(wH.actors || {})) {
            if (!a || a.dead || a.id === meH?.id) continue;
            if (a.location !== meH?.location) continue;
            const outer = /家丁|护院|门房|小厮|马夫|脚夫|客卿|管事|伙计/.test(String(a.role || ''));
            if (!outer) continue;
            const mv = moveActor(wH, a.id, hallId, 'world', '厅上候令');
            if (mv?.ok) names.push(a.name);
          }
          if (names.length) {
            saveState(this.dataDir, wH);
            reply += `\\n【提示】${names.join('、')}都到议事厅去了。`;
            console.log(`[Departure] 都到议事厅：${names.join('、')}`);
          }
        }
      }
    } catch (err) { console.warn('[Departure] 厅上集合失败：', err.message); }

""" + anchor
if '8.7845 都到议事厅' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('都到议事厅')
