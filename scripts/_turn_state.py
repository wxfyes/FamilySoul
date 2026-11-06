import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'runInStateTurn' not in s:
    s = s.replace("import fs from 'node:fs';", "import fs from 'node:fs';\nimport { AsyncLocalStorage } from 'node:async_hooks';", 1)
    # 在 loadState 定义前加 turn store 与入口
    anchor = "export function loadState(dataDir) {"
    add = """const __turnAls = new AsyncLocalStorage();

/**
 * 一轮业务（一次聊天）内：只解析一次世界账，只写一次盘。
 * 中途所有 loadState 都拿到同一份；所有 saveState 只记脏，不落盘。
 */
export async function runInStateTurn(fn) {
  const store = { world: null, dataDir: null, dirty: false };
  return __turnAls.run(store, async () => {
    try {
      return await fn();
    } finally {
      try {
        if (store.dirty && store.world && store.dataDir) {
          __stateBatch = null;
          saveState(store.dataDir, store.world);
        }
      } catch (err) {
        console.warn('[State] 回合落盘失败：', err.message);
      }
    }
  });
}

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
    # loadState 命中 turn store
    s = s.replace("""export function loadState(dataDir) {
  const S = globalThis.__stateStats;
  S.loads += 1;""",
"""export function loadState(dataDir) {
  const S = globalThis.__stateStats;
  S.loads += 1;
  const __turn = __turnAls.getStore();
  if (__turn) {
    if (__turn.world) return __turn.world;
    const __file = statePath(dataDir);
    try {
      const __st = fs.statSync(__file);
      const __key = path.resolve(__file);
      if (__stateCache.world && __stateCache.key === __key && __stateCache.mtime === __st.mtimeMs && __stateCache.size === __st.size) {
        S.hits += 1;
        __turn.world = __stateCache.world;
        __turn.dataDir = dataDir;
        return __turn.world;
      }
      S.parses += 1;
      const t0 = Date.now();
      __turn.world = structuredClone(JSON.parse(fs.readFileSync(__file, 'utf8')));
      S.parseMs += Date.now() - t0;
      __turn.dataDir = dataDir;
      return __turn.world;
    } catch {
      __turn.world = null;
      return null;
    }
  }""", 1)
    # saveState 在 turn 内只记脏
    s = s.replace("""export function saveState(dataDir, world) {
  const S = globalThis.__stateStats;""",
"""export function saveState(dataDir, world) {
  const __turn = __turnAls.getStore();
  if (__turn) {
    __turn.world = world;
    __turn.dataDir = dataDir;
    __turn.dirty = true;
    globalThis.__stateStats.saves += 1;
    return;
  }
  const S = globalThis.__stateStats;""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('ALS 回合')
