import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "function runSchedules(world) {"
block = '''// 按身份把人钉在该在的地方：铺子要有伙计，衙门要有官，夜里回家
function runRoutines(world) {
  const hour = Number(world.clock?.hour) || 0;
  const isDay = hour >= 6 && hour < 21;
  const isOffice = hour >= 7 && hour < 18;
  const husbandPlace = world.actors?.husband?.location;
  const party = new Set(Array.isArray(world.party?.husband) ? world.party.husband : []);

  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || !a.name) continue;
    if (a.id === 'husband') continue;
    if (party.has(a.id)) continue;                                   // 跟着相公的人不动
    if (a.intimacy?.ritual === 'unlocked') continue;                 // 正在私会的人不动
    if (a.away && Number(a.away.untilDay) >= Number(world.clock?.day)) continue; // 外派的人不动

    const role = String(a.role || '');
    const home = a.home && world.places?.[a.home] ? a.home : null;
    const work = (a.work && world.places?.[a.work]) ? a.work : home;

    let want = null;
    let doing = '';

    if (/知府|知县|尚书|宰相|巡抚|典吏|书吏|衙役|统领|主簿|县令/.test(role)) {
      // 官吏：白天坐衙，晚上回宅
      const yamen = Object.keys(world.places || {}).find((k) => world.places[k]?.name === (a.office || '临江县衙')) || 'yamen';
      want = isOffice ? (world.places?.[yamen] ? yamen : home) : home;
      doing = isOffice ? '坐衙理事' : '在家';
    } else if (/掌柜|东家|老板|伙计|小二|跑堂|摊|屠|铁匠|郎中|绣娘|账房|老鸨|鸨母|牙人|行商/.test(role)) {
      // 做买卖的：开门时节在铺子，打烊回家
      want = isDay ? work : home;
      doing = isDay ? '看铺子' : '歇下了';
    } else if (/夫人|妾|娘子|小姐|丫鬟|嬷嬷|婆子|妾身/.test(role)) {
      want = home;
      doing = '在家';
    } else {
      want = home;
      doing = isDay ? '在住处' : '歇下了';
    }

    if (!want || a.location === want) continue;
    a.location = want;
    a.activity = { text: doing, at: hour, day: world.clock?.day || 1 };

    // 走到相公所在 → 才可能来见（这里只记录，不打断）
    if (husbandPlace && want === husbandPlace) {
      a.activity = { text: '来寻相公', at: hour, day: world.clock?.day || 1 };
    }
  }
}

'''
if anchor in s and 'function runRoutines' not in s:
    s = s.replace(anchor, block + anchor, 1)
    print('① 加入按身份作息')

# 在 tick 里调用（runSchedules 之后）
if 'runRoutines(world);' not in s:
    s = s.replace("  runSchedules(world);", "  runSchedules(world);\n  try { runRoutines(world); } catch { /* 忽略 */ }", 1)
    print('② 每小时执行一次')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
