import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            fixed.push(`${a.name}：${a.role}→侧室`);
            a.role = '侧室';
            a.title = '侧室';
            a.marital = 'concubine';"""
new = """            fixed.push(`${a.name}：${a.role}→侧室`);
            a.role = '侧室';
            a.title = '侧室';
            a.marital = 'concubine';
            const eastRoom = Object.keys(world.places || {}).find((id) => /mansion_east/.test(id));
            if (eastRoom) { a.home = eastRoom; a.location = eastRoom; }
            if (a.intimacy) { a.intimacy.ritual = 'solemn'; a.intimacy.tone = 0; }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('侧室迁东厢')
