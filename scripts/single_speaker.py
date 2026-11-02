import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    this.saveHistory(profileKey, history);\n\n    return {"
new = (
    "    // 全场收口：一句问话里点了谁，就只留谁的话；旁人（含婉儿）的段落掐掉\n"
    "    try {\n"
    "      const wEnd = loadState(this.dataDir);\n"
    "      const sayText = String(say || '');\n"
    "      const namedHere = Object.values(wEnd.actors || {}).filter(\n"
    "        (a) => a && !a.dead && a.name && sayText.includes(a.name),\n"
    "      );\n"
    "      if (namedHere.length === 1 && reply && /【[^】]+】/.test(String(reply))) {\n"
    "        const keepName = namedHere[0].name;\n"
    "        const placeName = String(wEnd.places?.[namedHere[0].location]?.name || '');\n"
    "        const segs = String(reply).split(/(?=【[^】\\n]{1,12}】)/).filter(Boolean);\n"
    "        const kept = segs.filter((seg) => {\n"
    "          const m = seg.match(/^【([^】\\n]{1,12})】/);\n"
    "          if (!m) return true;\n"
    "          const who = m[1].trim();\n"
    "          if (who === keepName || (placeName && who === placeName)) return true;\n"
    "          if (/(天道|旁白|众人)/.test(who)) return true;\n"
    "          const actor = Object.values(wEnd.actors || {}).find((a) => a && a.name === who);\n"
    "          if (actor && actor.id !== namedHere[0].id) {\n"
    "            console.log(`[Scene] 只留${keepName}，掐掉${who}`);\n"
    "            return false;\n"
    "          }\n"
    "          return true;\n"
    "        });\n"
    "        const joined = kept.join('').trim();\n"
    "        if (joined) reply = joined;\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    this.saveHistory(profileKey, history);\n\n    return {"
)
if old in s and '一句问话里点了谁' not in s:
    s = s.replace(old, new, 1)
    print('patched: single-speaker filter for all accounts')
else:
    print('WARN: return anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
