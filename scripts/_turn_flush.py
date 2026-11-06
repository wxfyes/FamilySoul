import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("""        if (store.dirty && store.world && store.dataDir) {
          __stateBatch = null;
          saveState(store.dataDir, store.world);
        }""",
"""        if (store.dirty && store.world && store.dataDir) {
          __stateBatch = null;
          store.flushing = true;
          saveState(store.dataDir, store.world);
          store.flushing = false;
          store.dirty = false;
        }""", 1)
s = s.replace("""  const __turn = __turnAls.getStore();
  if (__turn) {
    __turn.world = world;""",
"""  const __turn = __turnAls.getStore();
  if (__turn && !__turn.flushing) {
    __turn.world = world;""", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('修正 flush')
