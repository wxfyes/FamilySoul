import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 府中兵事与存粮：家眷与管家自然知道家里有多少兵、多少粮（不必相公逐条交代）"
add = """    // 开场：这是他入世后的第一次开口——把他此刻的处境照实摆出来，让天道开场
    try {
      const hist0 = this.readHistory(profileKey).messages || [];
      if (hist0.length === 0) {
        const wF0 = loadState(this.dataDir);
        const meF0 = wF0.actors?.[selfId] || wF0.actors?.husband;
        const here0 = wF0.places?.[meF0?.location];
        const isNewbie = /^usr_/.test(String(selfId || ''));
        if (isNewbie) {
          contextHintEarly += `（【入世第一面】他刚入世，此刻在「${here0?.name || '自家小院'}」，身上只有 ${Number(meF0?.money ?? 2).toFixed(2)} 两碎银；这屋子是他自己的，简陋但能遮风。`
            + `本轮是开场：先照实写他在哪、这屋子什么样、手里有多少钱，再让他自己开口想去做什么；别替他安排营生，也别写他"已经在做什么"。）\\n`;
        }
      }
    } catch { /* 忽略 */ }

""" + anchor
if '入世第一面' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 加开场引导事实')
