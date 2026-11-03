import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 事实行已经说了她在哪 → 不再重复报位置
old = (
    "      if (absent) {\n"
    "        const whereA = String(wAbs.places?.[absent.location]?.name || '别处');"
)
new = (
    "      if (absent && !String(reply || '').includes(String(wAbs.places?.[absent.location]?.name || ''))) {\n"
    "        const whereA = String(wAbs.places?.[absent.location]?.name || '别处');"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: no duplicate location')

# ② 问旧事但账本没有 → 老实说不记得，不许编
anchor = "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
block = (
    "    // 问旧事：账本里没有，就不许编\n"
    "    try {\n"
    "      const askPast = /(还记得|记不记得|记得吗|以前|上次|那回|从前|当年|旧事)/.test(String(say || ''));\n"
    "      if (askPast) {\n"
    "        const wP2 = loadState(this.dataDir);\n"
    "        const meP = this._viewerActorId ? wP2.actors?.[this._viewerActorId] : wP2.actors?.husband;\n"
    "        const hereP = Object.values(wP2.actors || {}).filter((a) => a && !a.dead && a.location === meP?.location && a.id !== 'husband' && a.id !== this._viewerActorId);\n"
    "        const names = hereP.map((a) => a.name);\n"
    "        const pool = (wP2.memories || []).filter((m) => {\n"
    "          const t = String(m?.text || '');\n"
    "          return names.some((n) => t.includes(n)) || t.includes('相公') || m.visible === 'public';\n"
    "        });\n"
    "        if (!pool.length) {\n"
    "          const speaker = String(reply || '').match(/^【([^】\\n]{1,12})】/);\n"
    "          const who = speaker ? speaker[1] : (hereP[0]?.name || '');\n"
    "          if (who) {\n"
    "            reply = `【${who}】：（想了想，摇头）这事我记不得了。`;\n"
    "            console.log('[Memory] 账本无旧事，已拦住编造');\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
)
if anchor in s and '[Memory] 账本无旧事' not in s:
    s = s.replace(anchor, block, 1)
    print('patched: no fabricated past')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
