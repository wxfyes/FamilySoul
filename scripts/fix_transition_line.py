import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const movedNow = Boolean(typeof summonResult !== 'undefined' && summonResult && ((summonResult.moved || []).length > 0 || summonResult.left));"
)
new = (
    "        const movedNow = Boolean(typeof summonResult !== 'undefined' && summonResult && ((summonResult.moved || []).length > 0 || summonResult.left));\n"
    "        // 换了地方：旧对话对象作废，且必须有一句转场\n"
    "        if (movedNow && this._viewerActorId) {\n"
    "          try {\n"
    "            const wt = loadState(this.dataDir);\n"
    "            wt.chatPartners = wt.chatPartners || {};\n"
    "            delete wt.chatPartners[this._viewerActorId];\n"
    "            saveState(this.dataDir, wt);\n"
    "          } catch { /* 忽略 */ }\n"
    "          const placeNow2 = String(wPost.places?.[locPost]?.name || '');\n"
    "          if (placeNow2) {\n"
    "            const head = `【${placeNow2}】：（你到了${placeNow2}。）`;\n"
    "            const rest = String(reply || '').split('\\n').filter((x) => x && !/你到了|没人应声|没人接话/.test(x));\n"
    "            reply = [head, ...rest].join('\\n').trim();\n"
    "          }\n"
    "        }"
)
if old in s and '旧对话对象作废' not in s:
    s = s.replace(old, new, 1)
    print('patched: transition forces narration + clears partner')
else:
    print('WARN: movedNow line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
