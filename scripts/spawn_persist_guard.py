import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      if (applied.length > 0) console.log(`[World] 天道回执 ${applied.length} 条：${applied.join('、')}`);"
new = (
    "      if (applied.length > 0) console.log(`[World] 天道回执 ${applied.length} 条：${applied.join('、')}`);\n"
    "      // 新人必须真的落进世界：被后续存档冲掉就补一次\n"
    "      try {\n"
    "        const spawnNames = applied.filter((x) => /^新人物:/.test(String(x))).map((x) => String(x).slice(4));\n"
    "        if (spawnNames.length) {\n"
    "          const wChk = loadState(this.dataDir);\n"
    "          const missing = spawnNames.filter((n) => !Object.values(wChk.actors || {}).some((a) => a && a.name === n));\n"
    "          if (missing.length) {\n"
    "            applyWorldTags(this.dataDir, missing.map((n) => ({ kind: 'spawn', args: { name: n, role: '城中人' } })), { selfId: this._viewerActorId });\n"
    "            console.log('[World] 新人补落账：' + missing.join('、'));\n"
    "          }\n"
    "        }\n"
    "      } catch { /* 忽略 */ }"
)
if old in s and '新人必须真的落进世界' not in s:
    s = s.replace(old, new, 1)
    print('patched: spawn persistence guard')
else:
    print('WARN: anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
