import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 没点名也没说"你们俩" → 只留一个人说话（对话对象优先）
anchor = "    // 点了好几个人：每人都得应一声，不许只有一个回"
block = (
    "    // 没点名、也没说\"你们俩\" → 只留一个说话的人（不许两个人抢话）\n"
    "    try {\n"
    "      const wS = loadState(this.dataDir);\n"
    "      const saidS = String(say || '');\n"
    "      const pluralS = /(你们两个|你们俩|你俩|你们两|两位|都来|都过来|一起)/.test(saidS);\n"
    "      const anyNamed = Object.values(wS.actors || {}).some((a) => {\n"
    "        if (!a || !a.name) return false;\n"
    "        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
    "        return saidS.includes(a.name) || (short && saidS.includes(short));\n"
    "      });\n"
    "      if (!pluralS && !anyNamed) {\n"
    "        const segs = String(reply || '').split(/(?=【[^】\\n]{1,12}】)/).filter(Boolean);\n"
    "        const speech = segs.filter((x) => /^【[^】]+】/.test(x) && !/(就站在|四下冷清|你到了)/.test(x));\n"
    "        if (speech.length > 1) {\n"
    "          const partnerId = String((wS.chatPartners || {})[this._viewerActorId || 'husband'] || '');\n"
    "          const partnerName = wS.actors?.[partnerId]?.name || '';\n"
    "          const keep = speech.find((x) => partnerName && x.includes(partnerName)) || speech[0];\n"
    "          reply = keep.trim();\n"
    "          console.log('[Scene] 没点名：只留' + (partnerName || '第一个人') + '说话');\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 点了好几个人：每人都得应一声，不许只有一个回"
)
if anchor in s and '只留一个说话的人' not in s:
    s = s.replace(anchor, block, 1)
    print('patched: single speaker when nobody named')

# ② 叫她跟着去 → 她真的跟着走
anchor2 = "    // 有人说正经台词了，旁白就别再占一行（它会每轮重复同一句）"
block2 = (
    "    // 「跟我去/陪我去」→ 她真的跟着走，不许站着讲理由\n"
    "    try {\n"
    "      const saidG = String(say || '');\n"
    "      if (/(跟我去|跟我来|陪我去|随我去|一起去|同去)/.test(saidG)) {\n"
    "        const wG = loadState(this.dataDir);\n"
    "        const meG = this._viewerActorId ? wG.actors?.[this._viewerActorId] : wG.actors?.husband;\n"
    "        const partnerIdG = String((wG.chatPartners || {})[this._viewerActorId || 'husband'] || '');\n"
    "        const target = wG.actors?.[partnerIdG];\n"
    "        if (target && meG && !target.dead && target.location !== meG.location) {\n"
    "          target.location = meG.location;\n"
    "          target.activity = { text: '跟着同行', at: wG.clock?.hour || 0, day: wG.clock?.day || 1 };\n"
    "          saveState(this.dataDir, wG);\n"
    "          console.log(`[Scene] ${target.name}跟着走了`);\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 有人说正经台词了，旁白就别再占一行（它会每轮重复同一句）"
)
if anchor2 in s and '跟着走了' not in s:
    s = s.replace(anchor2, block2, 1)
    print('patched: partner follows when asked')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
