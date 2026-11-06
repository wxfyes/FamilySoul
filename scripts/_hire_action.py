import io
p = 'src/world/chat-actions.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { startTradeRun, startNightMarket, drainBizNotices } from './business.js';",
              "import { startTradeRun, startNightMarket, drainBizNotices } from './business.js';\nimport { hireStaff } from './employment.js';\nimport { fallbackName } from './migration.js';", 1)
anchor = "  // 开房住店"
add = """  // 雇掌柜/伙计：东家出钱，掌柜管店
  if (/(雇|请|聘)(一个|个|一名|位)?\\s*(掌柜|二掌柜|伙计|跑堂|账房)/.test(say)) {
    const want = /账房/.test(say) ? '账房' : (/掌柜/.test(say) ? '掌柜' : (/跑堂/.test(say) ? '跑堂' : '伙计'));
    const prop = (world.assets?.properties || []).find((p) => p && String(p.name || '').includes(String(say).replace(/.*(?:雇|请|聘)/, '').trim().slice(0, 2)));
    const target = prop || (world.assets?.properties || [])[0];
    if (!target) {
      notices.push('（名下没有铺子，雇了人也无处安。）');
    } else if (want === '掌柜' && Object.values(world.actors || {}).some((a) => a && !a.dead && a.location === target.place && /掌柜/.test(String(a.role || '')))) {
      notices.push(`（${target.name}已经有掌柜了。）`);
    } else {
      const nm = fallbackName(world, 'male');
      const r = hireStaff(world, { propName: target.name, name: nm, role: want, hiredBy: me.id });
      if (r?.ok) {
        const staffActor = Object.values(world.actors || {}).find((a) => a && a.name === nm);
        if (staffActor) staffActor.location = target.place || staffActor.location;
        target.staff = (Number(target.staff) || 0) + 1;
        notices.push(`请了 ${nm} 到 ${target.name} 当${want}。`);
        world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
        world.ledger.push({ day, hour: world.clock?.hour || 0, delta: -0.5, title: `雇佣${want}`, by: 'husband', balance: (Number(world.assets?.silver) || 0) });
        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) - 0.5) * 100) / 100;
      } else {
        notices.push(`（${r?.error || '没雇成'}。）`);
      }
    }
  }

""" + anchor
if '雇掌柜/伙计' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('雇掌柜动作')
