import io

# ============ ① 聊天标签：说一句就挂待确认单（不白给） ============
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 8. 待付款声明：[[pay:标题|选项=价|选项=价]] 挂待付款，正文剥离"
block = '''    // 7.9 募兵/买军械：说了也要确认——挂待办单，等 App 点确认才真的花钱招人
    try {
      const milTag = reply.match(/\\[\\[(?:recruit|military):([^\\]]+)\\]\\]/);
      if (milTag) {
        const body3 = String(milTag[1] || '').split('|').map((x) => x.trim());
        const count = Math.max(1, Math.min(500, Math.round(Number(body3[0]) || 0) || 10));
        const wMil = loadState(dataDir);
        const meMil = this._viewerActorId ? wMil.actors?.[this._viewerActorId] : wMil.actors?.husband;
        const fMil = wMil.factions?.wangjia;
        const town = (Array.isArray(fMil?.cities) && fMil.cities[0]) || '临江府';
        const costRecruit = count * 12;
        const grainRecruit = Math.round(count * 0.5 * 10) / 10;
        wMil.pendingAction = {
          kind: 'military',
          id: `pend_mil_${Date.now()}`,
          title: '募兵',
          action: 'recruit',
          qty: count,
          city: town,
          options: [{ key: `募兵${count}`, label: `募兵 ${count} 人（耗粮 ${grainRecruit} 石）`, price: costRecruit }],
          by: meMil?.id || 'husband',
          askedDay: wMil.clock?.day || 1,
          askedHour: wMil.clock?.hour || 0,
        };
        saveState(dataDir, wMil);
        console.log(`[Mil] 天道报募兵：${count} 人，${costRecruit} 两，待确认`);
        reply = reply.replace(/\\[\\[(?:recruit|military):[^\\]]+\\]\\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

    // 7.95 买军械：[[gear:兵器|20]]
    try {
      const gearTag = reply.match(/\\[\\[gear:([^\\]]+)\\]\\]/);
      if (gearTag) {
        const parts = String(gearTag[1] || '').split('|').map((x) => x.trim());
        const kindMap = { 兵器: 'weapon', 甲: 'armor', 铠甲: 'armor', 马: 'horse', 战马: 'horse', 攻城器械: 'siege', 器械: 'siege' };
        const kind = kindMap[parts[0]] || 'weapon';
        const qty = Math.max(1, Math.min(500, Math.round(Number(parts[1]) || 0) || 10));
        const priceMap = { weapon: 3, armor: 5, horse: 20, siege: 300 };
        const nameMap = { weapon: '兵器', armor: '铠甲', horse: '战马', siege: '攻城器械' };
        const wG = loadState(dataDir);
        const meG = this._viewerActorId ? wG.actors?.[this._viewerActorId] : wG.actors?.husband;
        wG.pendingAction = {
          kind: 'military',
          id: `pend_gear_${Date.now()}`,
          title: '军械',
          action: 'gear',
          gearKind: kind,
          qty,
          options: [{ key: `${nameMap[kind]}${qty}`, label: `买${nameMap[kind]} ${qty} 件`, price: qty * priceMap[kind] }],
          by: meG?.id || 'husband',
          askedDay: wG.clock?.day || 1,
          askedHour: wG.clock?.hour || 0,
        };
        saveState(dataDir, wG);
        console.log(`[Mil] 天道报军械：${nameMap[kind]} ${qty}，待确认`);
        reply = reply.replace(/\\[\\[gear:[^\\]]+\\]\\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

''' + anchor
if '[[recruit' not in s:
    s = s.replace(anchor, block, 1)
    print('① 募兵/军械标签')

# 提示词：告诉天道可以这么写
hint_anchor = "      contextHintEarly += '（【打探规矩】"
hint = """      contextHintEarly += '（【兵事规矩】相公若要募兵、买军械，你不要自己报数，只写 [[recruit:人数]] 或 [[gear:兵器|数量]]（兵器/铠甲/战马/攻城器械）；引擎会算钱粮并让他在界面上确认，确认后才真的成军。）\\n';
""" + hint_anchor
if '【兵事规矩】' not in s:
    s = s.replace(hint_anchor, hint, 1)
    print('② 兵事规矩提示')

io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② server：确认时执行募兵/军械（跳过通用扣款，避免双扣） ============
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { recruit, buyGrain, besiege, bribeCity, fortify, march, stationTroops, transferPropertyGrain, troopsAt, totalTroops } from './world/warfare.js';",
              "import { recruit, buyGrain, besiege, bribeCity, fortify, march, stationTroops, transferPropertyGrain, troopsAt, totalTroops, buyGear } from './world/warfare.js';")

old = """        // 选哪一档
        const options = Array.isArray(pend.options) ? pend.options : [];"""
new = """        // 兵事单：募兵/军械自己扣钱（走同一入口），不重复收
        if (pend.kind === 'military') {
          ensureFactions(world);
          const rMil = pend.action === 'gear'
            ? buyGear(world, 'wangjia', String(pend.gearKind || 'weapon'), Number(pend.qty) || 0)
            : recruit(world, 'wangjia', Number(pend.qty) || 0, String(pend.city || ''));
          if (!rMil.ok) return sendJson(res, 200, { ok: false, error: rMil.error });
          delete world.pendingAction;
          saveState(DATA_DIR, world);
          const line = pend.action === 'gear'
            ? `（已购军械，银两照扣。现存：${JSON.stringify(rMil.gear || {})}）`
            : `（已募 ${pend.qty} 人，成军需七日。现总兵 ${rMil.troops}，驻 ${rMil.city}。）`;
          return sendJson(res, 200, { ok: true, line });
        }

        // 选哪一档
        const options = Array.isArray(pend.options) ? pend.options : [];"""
if old in t:
    t = t.replace(old, new, 1)
    print('③ 确认执行兵事单')

# 负载里带装备与新兵
t = t.replace("          stationed: f.stationed || {}, marches:",
              "          gear: f.gear || {}, fresh: Number(f.fresh) || 0, freshUntilDay: Number(f.freshUntilDay) || 0,\n          stationed: f.stationed || {}, marches:")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
