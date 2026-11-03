import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 删掉"整句替换成不记得"的硬模板
start = s.find("    // 问旧事：账本里没有，就不许编")
if start < 0:
    print('WARN: past guard not found')
else:
    end = s.find("    // 最后一道：所有后处理改的是 reply", start)
    if end < 0:
        print('WARN: end marker not found')
    else:
        s = s[:start] + s[end:]
        print('removed hard-coded 不记得 template')

# ② 改成提示词约束：账本没有就说记不得（由天道自己措辞）
anchor = "    // 问\"某人在哪\"：直接给准确位置"
hint = (
    "    // 旧事约束：账本没有，就别编（只给约束，不替它写台词）\n"
    "    try {\n"
    "      const askPastH = /(还记得|记不记得|记得吗|以前|上次|那回|从前|当年|旧事)/.test(String(say || ''));\n"
    "      if (askPastH) {\n"
    "        const wPH = loadState(this.dataDir);\n"
    "        const mePH = this._viewerActorId ? wPH.actors?.[this._viewerActorId] : wPH.actors?.husband;\n"
    "        const herePH = Object.values(wPH.actors || {}).filter((a) => a && !a.dead && a.location === mePH?.location && a.id !== 'husband' && a.id !== this._viewerActorId);\n"
    "        const namesPH = herePH.map((a) => a.name);\n"
    "        const poolPH = (wPH.memories || []).filter((m) => {\n"
    "          const t = String(m?.text || '');\n"
    "          return namesPH.some((n) => t.includes(n)) || t.includes('相公') || m.visible === 'public';\n"
    "        });\n"
    "        if (poolPH.length) {\n"
    "          contextHint += `（【账本·旧事】${poolPH.slice(-4).map((m) => m.text).join('；')}\\n`;\n"
    "          contextHint += '——她要问这些，就照这条说；账本里没有的，只说记不得。）\\n';\n"
    "        } else {\n"
    "          contextHint += '（【账本·旧事】关于这件事，账本里什么都没有。你只能说自己记不得/没这回事，绝不许编细节，也不要编她的身世或往事。）\\n';\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 问\"某人在哪\"：直接给准确位置"
)
if anchor in s and '【账本·旧事】' not in s:
    s = s.replace(anchor, hint, 1)
    print('added past-memory constraint to prompt')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
