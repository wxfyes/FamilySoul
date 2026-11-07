import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：私兵没补够的，补齐到账上兵额"
add = """      // 一次性：错挂到王宅的丫鬟/婆子，按出身改回本处
      try {
        if (!world.flags?.servantHomeFixV1) {
          let fixed = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            const homeName = String(world.places?.[a.home]?.name || '');
            if (!homeName.startsWith('临江·王宅')) continue;
            if (String(a.spouse || '') === 'husband') continue;
            if (/正妻|如夫人|二房|侧室|妾|通房/.test(String(a.role || ''))) continue;
            if (String(a.id) === 'xiaocui') continue;
            if (a.household) continue;
            // 按 id 推本家：临江_servant_1_0 → 临江_estate_1
            const m = String(a.id).match(/^(.+?)_(?:servant|gentry)_(\\d+)/);
            const estate = m ? `${m[1]}_estate_${m[2]}` : null;
            if (estate && world.places?.[estate]) {
              a.home = estate;
            } else {
              // 铺面当差的：住处跟铺面；其余就算街坊
              const loc = world.places?.[a.location];
              a.home = loc && loc.residence ? a.location : 'street';
            }
            fixed += 1;
          }
          world.flags = world.flags || {};
          world.flags.servantHomeFixV1 = { at: Date.now(), fixed };
          if (fixed) console.log(`[House] 错挂丫鬟归位：${fixed} 人`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'servantHomeFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 丫鬟归位')

# ② 家仆过滤：人必须在宅里
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
old = """              && (a.spouse === 'husband'
                || (/妻|夫人|妾|姨娘|通房|丫鬟|婆子|嬷嬷|姑娘|小姐/.test(String(a.role || ''))
                  && (() => {
                    const pl = world.places?.[a.home];
                    const nm = String(pl?.name || '');
                    return Boolean(meL?.home && (a.home === meL.home || pl?.parent === meL.home
                      || nm.startsWith('临江·王宅') || nm.startsWith('王宅')));
                  })())),"""
new = """              && (a.spouse === 'husband'
                || (/妻|夫人|妾|姨娘|通房|丫鬟|婆子|嬷嬷|姑娘|小姐/.test(String(a.role || ''))
                  && (() => {
                    const estate = String(world.places?.[meL?.home]?.name || '').split('·').slice(0, 2).join('·');
                    const locName = String(world.places?.[a.location]?.name || '');
                    if (!estate || !locName.startsWith(estate)) return false;   // 人不在宅里，不算家仆
                    return true;
                  })())),"""
if old in t:
    t = t.replace(old, new, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 过滤收紧')
