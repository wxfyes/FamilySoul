import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 势力负载按身份过滤：不是家主就别看王家的兵粮
old = """        factions: Object.values(world.factions || {}).map((f) => ({"""
new = """        factions: (() => {
          const meId = actorId || 'husband';
          const isBoss = meId === 'husband' || world.factions?.wangjia?.leader === meId;
          return Object.values(world.factions || {}).map((f) => {
            const mine = f && (f.id !== 'wangjia' || isBoss);
            return {
              id: f.id, name: f.name, kind: f.kind, leader: f.leader,
              troops: mine ? (Number(f.troops) || 0) : null,
              grain: mine ? (Number(f.grain) || 0) : null,
              silver: mine ? (Number(f.silver) || 0) : null,
              morale: Number(f.morale) || 0,
              ambition: Number(f.ambition) || 0,
              strength: mine ? (Number(f.strength) || 0) : null,
              cities: Array.isArray(f.cities) ? f.cities : [],
              gear: mine ? (f.gear || {}) : {},
              kinds: mine ? (f.kinds || {}) : {},
              monthlyPay: mine ? (Number(f.monthlyPay) || 0) : null,
              monthlyGrain: mine ? (Number(f.monthlyGrain) || 0) : null,
              arrears: mine ? (f.arrears || { months: 0, owed: 0 }) : null,
              fresh: Number(f.fresh) || 0,
              freshUntilDay: Number(f.freshUntilDay) || 0,
              stationed: mine ? (f.stationed || {}) : {},
              hidden: !mine,
            };
          });
        })(),
        __old_factions_placeholder: Object.values(world.factions || {}).map((f) => ({"""
if old in s and 'hidden: !mine' not in s:
    s = s.replace(old, new, 1)
    # 删掉旧的占位对象（原 map 的剩余部分难以复用，整段替换为 null）
    s = s.replace("        __old_factions_placeholder: Object.values(world.factions || {}).map((f) => ({", "        __old_factions_placeholder: [],\n        __discarded: (() => {\n          const _x = ({", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 势力负载按身份过滤（临时结构）')
