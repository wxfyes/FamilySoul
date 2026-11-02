import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 回执标签绝不能出现在回复里"
block = (
    "    // 不在场的人不许说话：与地点不符的段落一律掐掉\n"
    "    try {\n"
    "      if (reply) {\n"
    "        const wLoc = loadState(this.dataDir);\n"
    "        const locId2 = this._viewerActorId ? wLoc.actors?.[this._viewerActorId]?.location : wLoc.actors?.husband?.location;\n"
    "        const presentNames = new Set(\n"
    "          Object.values(wLoc.actors || {})\n"
    "            .filter((a) => a && !a.dead && a.location === locId2)\n"
    "            .map((a) => String(a.name || ''))\n"
    "            .concat([String(wLoc.places?.[locId2]?.name || '')]),\n"
    "        );\n"
    "        const segs3 = String(reply).split(/(?=【[^】\\n]{1,12}】)/).filter(Boolean);\n"
    "        const kept3 = segs3.filter((seg) => {\n"
    "          const m3 = seg.match(/^【([^】\\n]{1,12})】/);\n"
    "          if (!m3) return true;\n"
    "          const who = m3[1].trim();\n"
    "          if (presentNames.has(who)) return true;\n"
    "          if (/(天道|旁白|众人)/.test(who)) return true;\n"
    "          const knownActor = Object.values(wLoc.actors || {}).find((a) => a && a.name === who);\n"
    "          if (knownActor && knownActor.location !== locId2) {\n"
    "            console.log(`[Scene] 掐掉不在场的人：${who}`);\n"
    "            return false;\n"
    "          }\n"
    "          return true;\n"
    "        });\n"
    "        if (kept3.length && kept3.join('').trim()) reply = kept3.join('').trim();\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 回执标签绝不能出现在回复里"
)
if anchor in s and '不在场的人不许说话' not in s:
    s = s.replace(anchor, block, 1)
    print('added off-scene speaker filter')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
