import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 引入"去哪儿"唯一出处
if 'places-target.js' not in s:
    s = s.replace("import { quellBandits } from './world/bandits.js';",
                  "import { quellBandits } from './world/bandits.js';\nimport { resolvePlaceTarget } from './world/places-target.js';")
    print('① 引入 places-target')

# ② [[task]] 物理联动：改走 moveActor + 真实地点解析
old = """            const isOutTask = /(牙行|外头|跑一趟|码头|酒楼|茶山|市井|请|买|采|查|送|街)/.test(what);
            const isYardTask = /(倒座房|后院|东厢|西厢|厨房|灶房|库房|账册|名册|收拾)/.test(what);
            if (isOutTask) {
              const dest = /酒楼/.test(what) ? 'canal_restaurant'
                : /码头/.test(what) ? 'dock'
                : /茶山/.test(what) ? 'tea_mountain'
                : 'street';
              who.location = dest;
              who.away = { place: dest, untilDay: (Number(wT.clock?.day) || 1) + Math.min(days, 2) };
              console.log(`[Task] ${who.name} 领命出府办差 → ${dest}`);
            } else if (isYardTask) {
              const dest = /东厢/.test(what) ? 'east_wing' : 'backyard';
              who.location = dest;
              console.log(`[Task] ${who.name} 领命去后院/厢房忙内务 → ${dest}`);
            }"""
new = """            // 去哪儿由 places-target 统一翻译成真实地点，位移只走 moveActor
            const dest = resolvePlaceTarget(wT, what, { nearId: who.location, actor: who });
            const moved = dest ? moveActor(wT, who.id, dest, 'world', `领差：${String(what).slice(0, 12)}`) : { ok: false };
            if (moved?.ok) {
              who.away = { place: dest, untilDay: (Number(wT.clock?.day) || 1) + Math.min(days, 2) };
              console.log(`[Task] ${who.name} 领命离开 → ${wT.places?.[dest]?.name || dest}`);
            } else {
              console.warn(`[Task] ${who.name} 没能动身（${moved?.error || '无去处'}）`);
            }"""
if old in s:
    s = s.replace(old, new, 1)
    print('② task 联动改走单一入口')

# ③ 定位 moveActor 是否已引入
if 'moveActor' not in s.split('\n')[0:60].__str__():
    if "from './world/position.js'" not in s:
        s = s.replace("import { resolvePlaceTarget } from './world/places-target.js';",
                      "import { resolvePlaceTarget } from './world/places-target.js';\nimport { moveActor } from './world/position.js';")
        print('③ 引入 moveActor')
io.open(p, 'w', encoding='utf-8-sig').write(s)
