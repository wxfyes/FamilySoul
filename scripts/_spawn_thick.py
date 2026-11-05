import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """          relations: { husband: { trust: 50, desire: 30, fear: 0, grievance: 0 } },"""
new = """          age: inferAgeFromIdentity(name, args.role, String(args.gender || ''), id),
          marital: inferMaritalStatus(name, args.role, inferAgeFromIdentity(name, args.role, String(args.gender || ''), id), String(args.gender || 'male')),
          money: (() => {
            // 初来乍到也得有盘缠：按身份给，绝不空腹入世
            const r = String(args.role || '');
            if (/客商|掌柜|东家|盐商|富商/.test(r)) return Math.round((8 + Math.random() * 15) * 10) / 10;
            if (/郎中|教书|相士|捕头|镖头/.test(r)) return Math.round((3 + Math.random() * 5) * 10) / 10;
            if (/小贩|货郎|绣娘|帮佣|伙计|茶博士/.test(r)) return Math.round((1 + Math.random() * 2) * 10) / 10;
            if (/流民|乞儿|叫花子/.test(r)) return Math.round(Math.random() * 0.3 * 100) / 100;
            return Math.round((1 + Math.random() * 3) * 10) / 10;
          })(),
          relations: (() => {
            const rel = { husband: { trust: 50, desire: 30, fear: 0, grievance: 0 } };
            try {
              const peers = Object.values(world.actors || {}).filter(
                (a) => a && !a.dead && a.id !== id && (a.location === assignedLoc || a.home === assignedHome),
              );
              if (peers.length) {
                const peer = peers[Math.floor(Math.random() * peers.length)];
                rel[peer.id] = { trust: 60, relation: '街坊' };
                peer.relations = peer.relations || {};
                peer.relations[id] = { trust: 60, relation: '街坊' };
              }
            } catch { /* 忽略 */ }
            return rel;
          })(),"""
if old in s and '初来乍到也得有盘缠' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① spawn 厚实化（年龄/婚配/盘缠/街坊）')
