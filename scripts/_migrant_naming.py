import io

# ① 时钟：只登记来客；三天后落脚
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'settleMigrants' not in s:
    s = s.replace("import { runMigration } from './migration.js';",
                  "import { runMigration, settleMigrants } from './migration.js';")
    anchor = """  // 每月：人口流动（灾荒逃难、招工投奔、商旅往来、投亲嫁娶——由事出人，不按配额）"""
    add = """  // 每日：落脚（来了三天的人，自己在城里安身）
  try {
    for (const ev of settleMigrants(world, events, nextEvent)) {
      events.push(nextEvent(world, ev));
    }
  } catch (err) {
    console.warn('[Migrate] 落脚失败：', err.message);
  }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('① 时钟接落脚')

# ② server：天道定名（无 LLM 时三天后兜底）
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'processMigrants' not in t:
    t = t.replace("import { buyGoods, sellGoods, goodsSnapshot } from './world/trade.js';",
                  "import { buyGoods, sellGoods, goodsSnapshot } from './world/trade.js';\n"
                  "import { materializeMigrant, fallbackName } from './world/migration.js';")
    anchor2 = "  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）"
    fn = '''  // 来客：由天道定名与来历；三天没有天道应答，就由引擎草草落下（不至于卡住）
  async function processMigrants() {
    try {
      const world = peek(DATA_DIR);
      world.pendingMigrants = Array.isArray(world.pendingMigrants) ? world.pendingMigrants : [];
      if (!world.pendingMigrants.length) return;
      const today = Number(world.clock?.day) || 1;
      const fresh = world.pendingMigrants.filter((m) => m && !m.asked).slice(0, 3);
      const stale = world.pendingMigrants.filter((m) => m && today - Number(m.day) >= 3);

      // 三天没等到天道：引擎兜底
      for (const pm of stale) {
        const a = materializeMigrant(world, pm, { name: fallbackName(world, pm.gender) });
        if (a) console.log(`[Migrate] 兜底落下 ${a.name}（${pm.role}）`);
      }
      if (stale.length) {
        world.pendingMigrants = world.pendingMigrants.filter((m) => !stale.includes(m));
      }

      // 天道定名
      if (petService.llmClient?.isReady?.() && fresh.length) {
        const list = fresh.map((m, i) => `${i + 1}. ${m.role}（${m.gender === 'female' ? '女' : '男'}，约${m.age}岁，${m.cause === 'refugee' ? '逃荒来的' : m.cause === 'merchant' ? '行商' : m.cause === 'bride' ? '投亲' : '投工'}）`).join('\\n');
        const system = '你是这个世界的天道，为刚进城的人定名与来历。只输出 JSON，不要解释。';
        const user = `第${today}日，临江府来了这些人：\\n${list}\\n\\n请给每个人取一个合乎古代身份的名字，并写一句来历（20字以内）。\\n输出：{"people":[{"index":1,"name":"张三","age":32,"background":"淮北逃荒来的，带着一个孩子"}]}`;
        try {
          const out = await petService.llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.8, maxTokens: 400 });
          const text = typeof out === 'string' ? out : (out?.text || out?.content || '');
          const m = text.match(/\\{[\\s\\S]*\\}/);
          if (m) {
            const data = JSON.parse(m[0]);
            for (const p of (data.people || [])) {
              const pm = fresh[Number(p.index) - 1];
              if (!pm) continue;
              const a = materializeMigrant(world, pm, { name: p.name, age: p.age, background: p.background });
              if (a) {
                console.log(`[Migrate] 天道定名：${a.name}（${pm.role}）${p.background || ''}`);
                world.pendingMigrants = world.pendingMigrants.filter((x) => x !== pm);
              }
            }
          }
        } catch (e) { console.warn('[Migrate] 天道定名失败：', e.message); }
        for (const pm of fresh) pm.asked = true;
      }
      saveState(DATA_DIR, world);
    } catch (err) {
      console.warn('[Migrate] 来客处理失败：', err.message);
    }
  }

''' + anchor2
    if anchor2 in t:
        t = t.replace(anchor2, fn, 1)
        # 每次心跳后调用
        t = t.replace("      onAfterTick: async () => {", "      onAfterTick: async () => {\n        await processMigrants();", 1)
        io.open(p2, 'w', encoding='utf-8-sig').write(t)
        print('② server 接天道定名')
