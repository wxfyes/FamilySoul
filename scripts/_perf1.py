import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
# 计数器
if 'globalThis.__stateStats' not in s:
    s = s.replace("let __stateCache = { key: '', mtime: 0, size: 0, world: null };",
"""globalThis.__stateStats = globalThis.__stateStats || { loads: 0, hits: 0, parses: 0, saves: 0, writes: 0, parseMs: 0, writeMs: 0, last: [] };
let __stateCache = { key: '', mtime: 0, size: 0, world: null };""", 1)
    # loadState 计数
    s = s.replace("""export function loadState(dataDir) {
  const file = statePath(dataDir);""",
"""export function loadState(dataDir) {
  const S = globalThis.__stateStats;
  S.loads += 1;
  const file = statePath(dataDir);""", 1)
    s = s.replace("""    if (__stateCache.world && __stateCache.key === key""",
"""    if (__stateCache.world && __stateCache.key === key""", 1)
    s = s.replace("""      return __stateCache.world;""",
"""      S.hits += 1;
      return __stateCache.world;""", 1)
    s = s.replace("""    __stateCache = { key, mtime: st.mtimeMs, size: st.size, world: structuredClone(__w) };""",
"""    S.parses += 1;
    const t0 = Date.now();
    __stateCache = { key, mtime: st.mtimeMs, size: st.size, world: structuredClone(__w) };
    S.parseMs += Date.now() - t0;""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('计数器 load')
