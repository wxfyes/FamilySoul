import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (String(world.flags.residenceSweptDay || '') !== today) {"""
new = """    const buildVer = String(world.flags.residenceBuildVersion || '');
    if (String(world.flags.residenceSweptDay || '') !== today || buildVer !== 'v3') {"""
if old in s:
    s = s.replace(old, new, 1)
    s = s.replace("      world.flags.residenceSweptDay = today;", "      world.flags.residenceSweptDay = today;\n      world.flags.residenceBuildVersion = 'v3';", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加建院版本闸（清档后强制重建一次）')
