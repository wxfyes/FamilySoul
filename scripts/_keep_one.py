import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const goers0 = namedAll.length ? namedAll : hereF.slice();"""
new = """        // "都出去，婉儿留下"：留下点名的，其余清场
        const saidNow2 = String(sayText || '');
        const keepRaw = /留下\\s*([\\u4e00-\\u9fa5]{2,4})|([\\u4e00-\\u9fa5]{2,4})\\s*留下/.exec(saidNow2);
        const keepName = keepRaw ? String(keepRaw[1] || keepRaw[2] || '').trim() : '';
        const keepActor = keepName
          ? Object.values(wF.actors || {}).find((a) => a && a.name && (a.name === keepName || a.name.endsWith(keepName)))
          : null;
        let goers0;
        if (keepActor && /都|出去|退下|散了|回去/.test(saidNow2)) {
          goers0 = hereF.filter((a) => a.id !== keepActor.id)
            .concat(namedAll.filter((a) => a.id !== keepActor.id && a.location !== meF?.location));
        } else if (namedAll.length) {
          goers0 = namedAll;
        } else {
          goers0 = hereF.slice();
        }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('留下例外')
