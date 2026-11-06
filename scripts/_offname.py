import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
# ① officials: 起名去重
old = """      world.actors[id] = {
        id,
        name: cityOfficialName(cityName),"""
new = """      const baseName = cityOfficialName(cityName);
      const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
      let offName = baseName;
      const sufO = ['', '二', '三', '四'];
      for (let i = 0; i < sufO.length && usedNames.has(offName); i += 1) offName = baseName + sufO[i];
      world.actors[id] = {
        id,
        name: offName,"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 官员起名去重')
