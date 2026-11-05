import io
# 时钟：每日军需 + 每月放饷
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { runMilitaryDay, setWarEventSink } from './warfare.js';",
              "import { runMilitaryDay, setWarEventSink, runPayday } from './warfare.js';")
old = """    setWarEventSink((w, ev) => {
      try { events.push(nextEvent(w, ev)); } catch { /* 忽略 */ }
    });
    runMilitaryDay(world, events);"""
new = """    setWarEventSink((w, ev) => {
      try { events.push(nextEvent(w, ev)); } catch { /* 忽略 */ }
    });
    runMilitaryDay(world, events);
    // 每月初一放饷；发不出就是欠饷，欠久了会逃兵、哗变
    for (const ev of runPayday(world, events)) {
      try { events.push(nextEvent(world, ev)); } catch { /* 忽略 */ }
    }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('时钟接放饷日')

# server：补饷接口 + 负载欠饷
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { recruit, buyGrain, besiege, bribeCity, fortify, march, stationTroops, transferPropertyGrain, troopsAt, totalTroops, buyGear, callToArms, upkeepOf } from './world/warfare.js';",
              "import { recruit, buyGrain, besiege, bribeCity, fortify, march, stationTroops, transferPropertyGrain, troopsAt, totalTroops, buyGear, callToArms, upkeepOf, payArrears } from './world/warfare.js';")
old2 = "        else if (act === 'call') result = callToArms(world, fid, { city: String(body.city || ''), max: Number(body.max) || 60, kind: String(body.kind || 'guard') });"
new2 = """        else if (act === 'call') result = callToArms(world, fid, { city: String(body.city || ''), max: Number(body.max) || 60, kind: String(body.kind || 'guard') });
        else if (act === 'pay_arrears') result = payArrears(world, fid);"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('② 接口加补饷')
# 负载带欠饷
t = t.replace("          monthlyPay: upkeepOf(world, f).monthlyPay, monthlyGrain: upkeepOf(world, f).monthlyGrain,",
              "          monthlyPay: upkeepOf(world, f).monthlyPay, monthlyGrain: upkeepOf(world, f).monthlyGrain,\n          arrears: f.arrears || { months: 0, owed: 0 },")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
