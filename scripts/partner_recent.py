import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① NPC 代演带上最近两轮，别每句都重新打招呼
old = "              recent: '',"
new = (
    "              recent: (() => {\n"
    "                try {\n"
    "                  const h = this.readHistory(profileKey).messages || [];\n"
    "                  return h.slice(-4).map((m) => String(m.text || '').slice(0, 50)).join('\\n');\n"
    "                } catch { return ''; }\n"
    "              })(),"
)
if old in s and 'recent: (() =>' not in s:
    s = s.replace(old, new, 1)
    print('patched: npc proxy gets recent turns')

# ② 相公号也记住对话对象
old2 = "    this.saveHistory(profileKey, history);\n\n    return {"
new2 = (
    "    // 记住这一轮是谁在说话（相公号也要有对象记忆）\n"
    "    try {\n"
    "      const wP = loadState(this.dataDir);\n"
    "      const speakers = [...String(reply || '').matchAll(/【([^】\\n]{1,12})】/g)].map((m) => m[1].trim());\n"
    "      const last = speakers.filter((n) => !/天道|旁白|众人/.test(n)).pop();\n"
    "      if (last) {\n"
    "        const hit = Object.values(wP.actors || {}).find((a) => a && a.name === last);\n"
    "        wP.chatPartners = wP.chatPartners || {};\n"
    "        const key = this._viewerActorId || 'husband';\n"
    "        if (hit && wP.chatPartners[key] !== hit.id) {\n"
    "          wP.chatPartners[key] = hit.id;\n"
    "          saveState(this.dataDir, wP);\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    this.saveHistory(profileKey, history);\n\n    return {"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: partner memory for husband account')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
