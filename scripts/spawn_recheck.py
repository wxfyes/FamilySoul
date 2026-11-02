import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "            if (applied2.length > 0) {\n"
    "              markReceiptHit(this.dataDir);\n"
    "              console.log(`[World] 记账员补登 ${applied2.length} 条：${applied2.join('、')}`);\n"
    "            }"
)
new = (
    "            if (applied2.length > 0) {\n"
    "              markReceiptHit(this.dataDir);\n"
    "              console.log(`[World] 记账员补登 ${applied2.length} 条：${applied2.join('、')}`);\n"
    "              // 新人落账后再核一次：别被并发的存档冲掉\n"
    "              const names = applied2.filter((x) => /^新人物:/.test(String(x))).map((x) => String(x).slice(4));\n"
    "              if (names.length) {\n"
    "                setTimeout(() => {\n"
    "                  try {\n"
    "                    const wc = loadState(this.dataDir);\n"
    "                    const miss = names.filter((n) => !Object.values(wc.actors || {}).some((a) => a && a.name === n));\n"
    "                    if (miss.length) {\n"
    "                      applyWorldTags(this.dataDir, miss.map((n) => ({ kind: 'spawn', args: { name: n, role: '城中人' } })), { selfId: this._viewerActorId });\n"
    "                      console.log('[World] 新人补落账：' + miss.join('、'));\n"
    "                    }\n"
    "                  } catch { /* 忽略 */ }\n"
    "                }, 1200);\n"
    "              }\n"
    "            }"
)
if old in s:
    s = s.replace(old, new)
    print('patched: re-check spawn after async apply')
else:
    print('WARN: anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
