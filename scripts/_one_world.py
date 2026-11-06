import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      S.parses += 1;
      const t0 = Date.now();
      __turn.world = structuredClone(JSON.parse(fs.readFileSync(__file, 'utf8')));
      S.parseMs += Date.now() - t0;
      __turn.dataDir = dataDir;
      return __turn.world;"""
new = """      S.parses += 1;
      const t0 = Date.now();
      const parsed = JSON.parse(fs.readFileSync(__file, 'utf8'));
      // 关键：回合里解析出来的这份，也要成为全局唯一的那一份
      __stateCache = { key: __key, mtime: __st.mtimeMs, size: __st.size, world: parsed };
      __turn.world = __stateCache.world;
      S.parseMs += Date.now() - t0;
      __turn.dataDir = dataDir;
      return __turn.world;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('回合解析即全局唯一')
