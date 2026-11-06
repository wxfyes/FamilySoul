import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "      // 出口最后一道观感清理：残缺括号、空的差事回执行"
new = """      // 出口：说话的人若不在跟前，把实情补一句（不搬人，只说实话）
      try {
        const wS = loadState(DATA_DIR);
        const meS = wS.actors?.[actorId] || wS.actors?.husband;
        const herePlace = wS.places?.[meS?.location]?.name || '';
        const spk = [...String(result.reply?.text || '').matchAll(/【([^】]{1,14})】/g)].map((m) => m[1]);
        const far = [];
        for (const sp of spk) {
          const nm = sp.includes('·') ? sp.split('·').pop().trim() : sp;
          if (!nm || nm === '旁白' || nm === meS?.name) continue;
          const a = Object.values(wS.actors || {}).find((x) => x && !x.dead && x.name === nm);
          if (!a) continue;
          const pn = wS.places?.[a.location]?.name || '';
          if (pn && herePlace && pn !== herePlace) far.push(`${a.name}（在${pn}）`);
        }
        if (far.length) {
          result.reply.text = `${result.reply.text}\\n（${[...new Set(far)].join('、')}并不在这间，是隔着屋子/街面应的声。）`;
        }
      } catch { /* 忽略 */ }

""" + old
if '并不在这间' not in s and old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('出口补实情')
