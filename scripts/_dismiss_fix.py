import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const hereF = Object.values(wF.actors || {}).filter(
          (a) => a && !a.dead && a.id !== meF?.id && a.location === meF?.location && !/^usr_/.test(String(a.id)),
        );
        // 只让"该走的人"走：不是主人家的客/当值的人
        const goers = hereF.filter((a) => !(a.household && meF?.id === 'husband'));
        if (goers.length && goers.length <= 3) {"""
new = """        const hereF = Object.values(wF.actors || {}).filter(
          (a) => a && !a.dead && a.id !== meF?.id && a.location === meF?.location
            && !a.humanBound && !/^usr_/.test(String(a.id)),
        );
        // 主人家自己不走；带"都/大伙"的就是清场
        const goers0 = hereF.filter((a) => !(a.household && meF?.id === 'husband'));
        const cap = /都|你们|大伙|诸位|全/.test(String(sayText || '')) ? 10 : 3;
        const goers = goers0.slice(0, cap);
        if (goers.length) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('patched dismiss rule')
