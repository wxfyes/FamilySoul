import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 去掉上一版无效的守卫
start = s.find("      // 她去哪儿是她的自由，但也不能顺带把相公搬过去")
end = s.find("      // 新人必须真的落进世界", start)
if start >= 0 and end >= 0:
    s = s[:start] + s[end:]
    print('removed flawed guard')

# ② 在应用回执前后记录相公位置
old = "      const applied = realOps.length > 0 ? applyWorldTags(this.dataDir, realOps, { selfId: this._viewerActorId }) : [];"
new = (
    "      const husBefore = (() => { try { return loadState(this.dataDir).actors?.husband?.location || null; } catch { return null; } })();\n"
    "      const applied = realOps.length > 0 ? applyWorldTags(this.dataDir, realOps, { selfId: this._viewerActorId }) : [];\n"
    "      // 她在自己账号里走动，绝不能把相公一起搬走（除非她点名叫他来）\n"
    "      try {\n"
    "        if (this._viewerActorId && this._viewerActorId !== 'husband' && husBefore) {\n"
    "          const calledHim = /(王甯|王掌柜|少掌柜|相公)/.test(String(say || ''));\n"
    "          const w1 = loadState(this.dataDir);\n"
    "          const hus1 = w1.actors?.husband;\n"
    "          const me1 = w1.actors?.[this._viewerActorId];\n"
    "          if (!calledHim && hus1 && me1 && hus1.location !== husBefore && hus1.location === me1.location) {\n"
    "            hus1.location = husBefore;\n"
    "            saveState(this.dataDir, w1);\n"
    "            console.log(`[Scene] 还原：${me1.name}走动不该带走相公（他仍在原处）`);\n"
    "          }\n"
    "        }\n"
    "      } catch { /* 忽略 */ }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: capture and revert husband move')
else:
    print('WARN: apply line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
