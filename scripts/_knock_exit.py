import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "        return sendJson(res, result.ok ? 200 : 500, {"
add = """        // 站在别人门口说"通禀/求见/递帖"：服务端这里真去叩门，门房的话直接写进回话
        try {
          const sayText = String(body.text || '');
          if (/通禀|通报|求见|递帖|递帖|叫门|叩门|拜见|拜访|请见|能进去|让我进去/.test(sayText)) {
            const wK = loadState(DATA_DIR);
            const meK = wK.actors?.[String(currentMember.actor || 'husband')] || wK.actors?.husband;
            const hereK = wK.places?.[meK?.location];
            const atGate = /大门|门房|门厅|仪门|轿厅/.test(String(hereK?.name || '')) || hereK?.use === 'gate';
            if (atGate && hereK?.parent) {
              const homeK = wK.places?.[hereK.parent];
              if (homeK?.residence && String(homeK.owner || '') !== String(meK?.id || '')) {
                const vK = knock(wK, meK.id, homeK.id);
                if (vK.allowed && vK.place) {
                  grantPass(wK, meK.id, homeK.id, wK.clock?.day);
                  moveActor(wK, meK.id, vK.place, 'world', '通禀允入');
                  saveState(DATA_DIR, wK);
                  const newName = wK.places?.[vK.place]?.name || '';
                  result.reply.text = `（门房进去回了话，回身让开：「${vK.reason}」你进了${newName}。）\\n` + String(result.reply.text || '');
                } else {
                  saveState(DATA_DIR, wK);
                  result.reply.text = `（门房拦住：「${vK.reason}」）\\n` + String(result.reply.text || '');
                }
              }
            }
          }
        } catch (err) { console.log('[Knock] 叩门异常：', err.message); }

""" + anchor
if '门房的话直接写进回话' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 出口统一处理叩门')
