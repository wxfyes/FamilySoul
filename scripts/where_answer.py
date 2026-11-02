import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "    this.saveHistory(profileKey, history);\n"
    "\n"
    "    return {\n"
    "      ok: true,\n"
    "      reply: assistantMsg,"
)
new = (
    "    // 问\"我在哪\"：引擎直接答，别让模型猜\n"
    "    try {\n"
    "      if (/(我(在|到了)?哪|这是哪|到哪儿了|在什么地方)/.test(String(say || ''))) {\n"
    "        const wHere2 = loadState(this.dataDir);\n"
    "        const locSelf = this._viewerActorId ? wHere2.actors?.[this._viewerActorId]?.location : wHere2.actors?.husband?.location;\n"
    "        const pName = String(wHere2.places?.[locSelf]?.name || '');\n"
    "        if (pName) {\n"
    "          assistantMsg.text = `【${pName}】：（你在${pName}。）`;\n"
    "          assistantMsg.audioKey = null;\n"
    "          console.log('[Where] 直接答位置：' + pName);\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    this.saveHistory(profileKey, history);\n"
    "\n"
    "    return {\n"
    "      ok: true,\n"
    "      reply: assistantMsg,"
)
if old in s and '直接答位置' not in s:
    s = s.replace(old, new, 1)
    print('patched: deterministic where answer')
else:
    print('WARN: return block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
