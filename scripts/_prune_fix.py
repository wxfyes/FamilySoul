import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    let allowed = null;
    const kind = premisesKind(name);
    if (kind) allowed = new Set(PREMISES[kind].map((r) => r.key));
    else if (/衙|县衙|府衙|公堂/.test(name)) allowed = new Set(COURT.map((r) => r.key));
    else if (p.grade || p.residence) continue;
    if (!allowed) continue;"""
new = """    // 商业/衙署优先按自己的模板清（哪怕它曾被误标成住宅）
    let allowed = null;
    const kind = premisesKind(name);
    if (kind) allowed = new Set(PREMISES[kind].map((r) => r.key));
    else if (/衙|县衙|府衙|公堂/.test(name)) allowed = new Set(COURT.map((r) => r.key));
    if (!allowed) continue;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('清理规则：商业/衙署优先')
