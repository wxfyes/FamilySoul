import io
p = 'scripts/healthcheck.mjs'
s = io.open(p, encoding='utf-8').read()
old = """    const atInn = a.place === '临江客栈' || a.place === '客栈';
    if (atInn) noResidence += 1;"""
new = """    // 有没有"自己的住处"看 home/residence，而不是此刻站在哪
    const hasRes = Boolean(a.residence && a.residence.placeId) || (a.home && a.home !== 'inn');
    if (!hasRes) noResidence += 1;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('体检判据改成 home/residence')
