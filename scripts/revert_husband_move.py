import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      if (applied.length > 0) console.log(`[World] 天道回执 ${applied.length} 条：${applied.join('、')}`);"
new = (
    "      if (applied.length > 0) console.log(`[World] 天道回执 ${applied.length} 条：${applied.join('、')}`);\n"
    "      // 她去哪儿是她的自由，但不能顺带把相公搬过去（记账员常犯这个错）\n"
    "      try {\n"
    "        if (this._viewerActorId && this._viewerActorId !== 'husband' && /移动:|move/.test(applied.join(','))) {\n"
    "          const w0 = loadState(this.dataDir);\n"
    "          const me0 = w0.actors?.[this._viewerActorId];\n"
    "          const hus0 = w0.actors?.husband;\n"
    "          const summonedHim = /(王甯|王掌柜|相公)/.test(String(say || ''));\n"
    "          if (hus0 && me0 && hus0.location === me0.location && !summonedHim && hus0.__movedByEngine) {\n"
    "            hus0.location = hus0.__movedByEngine;\n"
    "            delete hus0.__movedByEngine;\n"
    "            saveState(this.dataDir, w0);\n"
    "            console.log('[Scene] 记账员把相公搬到了她那里，已还原');\n"
    "          }\n"
    "        }\n"
    "      } catch { /* 忽略 */ }"
)
if old in s and '但也不能顺带把相公搬过去' not in s:
    s = s.replace(old, new, 1)
    print('patched: revert bookkeeper husband move')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
