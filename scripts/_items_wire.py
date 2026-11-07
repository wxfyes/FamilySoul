import io
# ① 种几件真东西
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { moneyCategory } from './ledger-rules.js';",
              "import { moneyCategory } from './ledger-rules.js';\nimport { ensureItems, addItem, itemsOf } from './items.js';", 1)
anchor = "      // 一次性：客栈只留一条门路"
add = """      // 一次性：给相公几件真东西（房契、酒楼契、茶坊契、茶山契）
      try {
        ensureItems(world);
        if (!world.flags?.itemSeedV1 && Object.keys(world.items).length === 0) {
          const seeds = [
            ['临江王宅房契', '契纸'], ['运河酒楼契', '契纸'],
            ['临江茶坊契', '契纸'], ['紫阳山茶山契', '契纸'],
            ['崔家请帖', '请帖'],
          ];
          for (const [nm, kind] of seeds) addItem(world, { name: nm, kind, holder: 'husband' });
          world.flags = world.flags || {};
          world.flags.itemSeedV1 = { at: Date.now(), n: seeds.length };
          console.log(`[Item] 入册 ${seeds.length} 件`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'itemSeedV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 物品种子')

# ② 聊天动作：给/要
p2 = 'src/world/chat-actions.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { startTradeRun, startNightMarket, drainBizNotices } from './business.js';",
              "import { startTradeRun, startNightMarket, drainBizNotices } from './business.js';\nimport { ensureItems, itemsOf, findItem, giveItem } from './items.js';", 1)
anchor2 = "  // 开房住店"
add2 = """  // 给东西：给/赏/送 某人 某物
  {
    const mGive = /(?:给|赏|送|递)\\s*([\\u4e00-\\u9fa5]{2,4})\\s*(?:一[份张封件])?\\s*([\\u4e00-\\u9fa5]{2,12})/.exec(say);
    if (mGive) {
      const who = findByName(world, mGive[1]);
      if (who && who.location === me.location) {
        const it = findItem(world, me.id, mGive[2]) || itemsOf(world, me.id).find((x) => mGive[2].includes(x.name.slice(-2)));
        if (it) {
          const r = giveItem(world, me.id, who.id, it.id);
          if (r.ok) notices.push(r.line.replace(/^（|）$/g, ''));
        } else {
          notices.push(`（你手里没有「${mGive[2]}」这件东西。）`);
        }
      }
    }
  }

  // 要东西：向/问 某人 要 某物
  {
    const mAsk = /(?:向|问|跟)\\s*([\\u4e00-\\u9fa5]{2,4})\\s*(?:要|讨|索取)\\s*([\\u4e00-\\u9fa5]{2,12})/.exec(say);
    if (mAsk) {
      const who = findByName(world, mAsk[1]);
      if (who) {
        const it = findItem(world, who.id, mAsk[2]);
        if (!it) {
          notices.push(`（${who.name}手里没有「${mAsk[2]}」。）`);
        } else {
          const trust = Number(who.relations?.[me.id]?.trust ?? who.relations?.husband?.trust ?? 0);
          const willing = trust >= 20 || String(who.spouse || '') === me.id || /正妻|如夫人|侧室|丫鬟/.test(String(who.role || ''));
          if (!willing) {
            notices.push(`（${who.name}没应声，把那件东西往身后收了收。）`);
          } else {
            const r = giveItem(world, who.id, me.id, it.id);
            if (r.ok) notices.push(`（${who.name}把《${it.name}》递了过来。）`);
          }
        }
      }
    }
  }

""" + anchor2
if '给东西：给/赏/送' not in t and anchor2 in t:
    t = t.replace(anchor2, add2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 给/要动作')

# ③ /api/me 露出随身物品
p3 = 'src/server.js'
u = io.open(p3, encoding='utf-8-sig').read()
u = u.replace("import { isPlaceNameOk } from './world/ledger-rules.js';",
              "import { isPlaceNameOk } from './world/ledger-rules.js';\nimport { itemsOf } from './world/items.js';", 1)
old3 = "        military: troops > 0 ? {"
new3 = """        items: itemsOf(world, actorId || 'husband').map((it) => ({ id: it.id, name: it.name, kind: it.kind })),
        military: troops > 0 ? {"""
if old3 in u and 'items: itemsOf' not in u:
    u = u.replace(old3, new3, 1)
    io.open(p3, 'w', encoding='utf-8-sig').write(u)
    print('③ me.items')
