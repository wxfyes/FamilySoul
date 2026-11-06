import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
# save 计数：在真正写盘处加（找到 writeFileSync 调用）
old = "  fs.writeFileSync"
idx = s.find("export function saveState(dataDir, world) {")
if idx > 0:
    seg = s[idx:idx+2500]
    if 'S.saves' not in seg:
        seg2 = seg.replace("export function saveState(dataDir, world) {",
"export function saveState(dataDir, world) {\n  const S = globalThis.__stateStats;\n  S.saves += 1;\n  const __t0 = Date.now();", 1)
        seg2 = seg2.replace("  fs.writeFileSync", "  S.writes += 1;\n  fs.writeFileSync", 1)
        s = s[:idx] + seg2 + s[idx+2500:]
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('计数器 save')
