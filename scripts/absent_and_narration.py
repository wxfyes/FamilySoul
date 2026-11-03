import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 事实行前面，把旁白行去掉
old = (
    "        const contradicted = /(么？|么\\?|听说|提过一嘴|哪家|外头|不认识|不认得|从哪儿听来)/.test(String(reply || ''));"
)
new = (
    "        // 先把旁白行剔掉，别让\"就站在…\"跟着事实一起出现\n"
    "        reply = String(reply || '').split('\\n').filter((x) => !/就站在|四下冷清|你到了/.test(x)).join('\\n').trim();\n"
    "        const contradicted = /(么？|么\\?|听说|提过一嘴|哪家|外头|不认识|不认得|从哪儿听来)/.test(String(reply || ''));"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: strip narration before fact')

# ② 问不在场的人 → 直接报位置（覆盖模型）
anchor = "    // 问到府里的人：引擎先把事实顶在最前面"
block = (
    "    // 点了一个不在场的人 → 直接报他在哪，别让在场的人对着他说话\n"
    "    try {\n"
    "      const wAbs = loadState(this.dataDir);\n"
    "      const saidA = String(say || '');\n"
    "      const meA2 = this._viewerActorId ? wAbs.actors?.[this._viewerActorId] : wAbs.actors?.husband;\n"
    "      const absent = Object.values(wAbs.actors || {}).find((a) => {\n"
    "        if (!a || a.dead || !a.name || a.id === this._viewerActorId) return false;\n"
    "        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
    "        const named = saidA.includes(a.name) || (short && saidA.includes(short));\n"
    "        return named && a.location !== meA2?.location;\n"
    "      });\n"
    "      if (absent) {\n"
    "        const whereA = String(wAbs.places?.[absent.location]?.name || '别处');\n"
    "        const hereA = String(wAbs.places?.[meA2?.location]?.name || '这里');\n"
    "        reply = `【${hereA}】：${absent.name}在「${whereA}」，眼下不在这儿。`;\n"
    "        console.log(`[Scene] 点名不在场：${absent.name}@${whereA}`);\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 问到府里的人：引擎先把事实顶在最前面"
)
if anchor in s and '点名不在场' not in s:
    s = s.replace(anchor, block, 1)
    print('patched: absent actor replies with location')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
