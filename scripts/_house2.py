import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """              && (a.spouse === 'husband'
                || (/妻|夫人|妾|姨娘|通房|丫鬟|婆子|嬷嬷|姑娘|小姐/.test(String(a.role || ''))
                  && Boolean(meL?.home && a.home === meL.home))),"""
new = """              && (a.spouse === 'husband'
                || (/妻|夫人|妾|姨娘|通房|丫鬟|婆子|嬷嬷|姑娘|小姐/.test(String(a.role || ''))
                  && (() => {
                    const pl = world.places?.[a.home];
                    const nm = String(pl?.name || '');
                    return Boolean(meL?.home && (a.home === meL.home || pl?.parent === meL.home
                      || nm.startsWith('临江·王宅') || nm.startsWith('王宅')));
                  })())),"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 后院认宅院各房')

p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """            let nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            for (let i = 0; i < 12 && nm && keep.has(nm); i += 1) nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            if (!nm) continue;"""
new2 = """            let nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            for (let i = 0; i < 8 && nm && keep.has(nm); i += 1) nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            if (!nm) continue;
            // 还是撞名就加辈字，保证真的不重
            let suffix = 0;
            const baseNm = nm;
            while (keep.has(nm)) { suffix += 1; nm = baseNm + ['二', '三', '四', '五', '六', '七', '八', '九'][suffix - 1] || (baseNm + suffix); if (suffix > 9) break; }"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 撞名加辈字')
