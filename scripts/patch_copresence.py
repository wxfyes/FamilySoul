import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 1) 引入模块
if 'co-presence' not in s:
    s = s.replace(
        "import { normalizeMemberReply } from './world/member-reply.js';",
        "import { normalizeMemberReply } from './world/member-reply.js';\n"
        "import { recordHumanLine, memberKeyOfActor } from './world/co-presence.js';",
    )

# 2) 她开口时：记进场景 + 投递给同地点的真人
anchor = "    // 她一开口就算\"在行动\"，主线不会因为躺平被世界替她定夺"
if anchor not in s:
    print('WARN: anchor for delivery not found')
else:
    block = (
        "    // 真人同场：她说的这句话，同地点的别人也听得见\n"
        "    try {\n"
        "      if (this._viewerActorId && String(say || '').trim()) {\n"
        "        const rootDir = path.dirname(this.dataDir);\n"
        "        const wScene = loadState(this.dataDir);\n"
        "        const meScene = wScene.actors?.[this._viewerActorId];\n"
        "        const placeScene = meScene?.location;\n"
        "        if (placeScene) {\n"
        "          recordHumanLine(this.dataDir, placeScene, this._viewerActorId, meScene.name || '', say);\n"
        "          for (const other of Object.values(wScene.actors || {})) {\n"
        "            if (!other || other.dead || other.id === this._viewerActorId) continue;\n"
        "            if (other.location !== placeScene) continue;\n"
        "            const otherKey = memberKeyOfActor(rootDir, other.id);\n"
        "            if (!otherKey) continue; // 不是真人账号（NPC 由 AI 演）\n"
        "            wScene.proactive = Array.isArray(wScene.proactive) ? wScene.proactive : [];\n"
        "            wScene.proactive.push({\n"
        "              id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,\n"
        "              type: 'human',\n"
        "              to: otherKey,\n"
        "              reason: 'human',\n"
        "              text: `【${meScene.name}】：${String(say).slice(0, 300)}`,\n"
        "              at: Date.now(),\n"
        "              day: wScene.clock?.day,\n"
        "              hour: wScene.clock?.hour,\n"
        "            });\n"
        "            wScene.proactive = wScene.proactive.slice(-20);\n"
        "            try {\n"
        "              const hOther = this.readHistory(otherKey);\n"
        "              hOther.messages = Array.isArray(hOther.messages) ? hOther.messages : [];\n"
        "              hOther.messages.push({ id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, role: 'assistant', text: `【${meScene.name}】：${String(say).slice(0, 300)}`, at: Date.now() });\n"
        "              if (hOther.messages.length > 200) hOther.messages = hOther.messages.slice(-200);\n"
        "              this.saveHistory(otherKey, hOther);\n"
        "            } catch { /* 忽略 */ }\n"
        "          }\n"
        "          saveState(this.dataDir, wScene);\n"
        "        }\n"
        "      }\n"
        "    } catch (err) {\n"
        "      console.warn('[Scene] 同场投递失败：', err.message);\n"
        "    }\n\n"
    )
    s = s.replace(anchor, block + anchor, 1)
    print('added co-presence delivery')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
