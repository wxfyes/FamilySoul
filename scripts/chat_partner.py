import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 读取"她上次在跟谁说话"
old = (
    "        const talkingToOther = Object.values(wPost.actors || {}).some("
)
new = (
    "        // 她上次在跟谁说话：接着那个人说，别让旁人插嘴\n"
    "        const partnerId = String((wPost.chatPartners || {})[this._viewerActorId] || '');\n"
    "        const partnerIsHusband = partnerId === 'husband';\n"
    "        const talkingToOther = Object.values(wPost.actors || {}).some("
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: read partner')

old2 = "        const askedHim = namedHim || (!talkingToOther && /(你|您)/.test(said));"
new2 = (
    "        const askedHim = namedHim || (!talkingToOther && (partnerIsHusband || !partnerId) && /(你|您)/.test(said));"
)
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: husband only when partner or named')

# ② 王甯说完 → 记下对象是他
old3 = "              console.log('[Proxy] 代演王甯：' + line.slice(0, 40));"
new3 = (
    "              console.log('[Proxy] 代演王甯：' + line.slice(0, 40));\n"
    "              try {\n"
    "                const wp = loadState(this.dataDir);\n"
    "                wp.chatPartners = wp.chatPartners || {};\n"
    "                wp.chatPartners[this._viewerActorId] = 'husband';\n"
    "                saveState(this.dataDir, wp);\n"
    "              } catch { /* 忽略 */ }"
)
if old3 in s:
    s = s.replace(old3, new3)
    print('patched: remember husband partner')

# ③ 普通 NPC：没点名时，接着上次的对话对象说
old4 = (
    "          const namedPresent = Object.values(wPost.actors || {}).filter("
)
new4 = (
    "          const partnerActor = !partnerId || partnerId === 'husband'\n"
    "            ? null\n"
    "            : (wPost.actors || {})[partnerId];\n"
    "          const partnerHere = partnerActor && !partnerActor.dead && partnerActor.location === locPost && partnerActor.name && !String(say || '').includes(partnerActor.name)\n"
    "            ? [partnerActor]\n"
    "            : [];\n"
    "          const namedPresent = Object.values(wPost.actors || {}).filter("
)
if old4 in s:
    s = s.replace(old4, new4, 1)
    print('patched: partner fallback for npc')

old5 = "          for (const npc of namedPresent.slice(0, 2)) {"
new5 = "          for (const npc of (namedPresent.length ? namedPresent : partnerHere).slice(0, 2)) {"
if old5 in s:
    s = s.replace(old5, new5, 1)
    print('patched: use partner when nobody named')

# ④ NPC 说完 → 记下对象
old6 = "              console.log('[Proxy] 代演' + npc.name + '：' + npLine.slice(0, 40));"
new6 = (
    "              console.log('[Proxy] 代演' + npc.name + '：' + npLine.slice(0, 40));\n"
    "              try {\n"
    "                const wp2 = loadState(this.dataDir);\n"
    "                wp2.chatPartners = wp2.chatPartners || {};\n"
    "                wp2.chatPartners[this._viewerActorId] = npc.id;\n"
    "                saveState(this.dataDir, wp2);\n"
    "              } catch { /* 忽略 */ }"
)
if old6 in s:
    s = s.replace(old6, new6)
    print('patched: remember npc partner')

# ⑤ 任何情况下，有别人说话了就把"没人接话"去掉
old7 = "    // 真人同场：她说的这句话，同地点的别人也听得见"
new7 = (
    "    // 有人应过声，就别再留\"没人接话\"\n"
    "    try {\n"
    "      if (reply && /【[^】]+】/.test(reply)) {\n"
    "        const kept = String(reply).split('\\n').filter((x) => !/没人应声|没人接话/.test(x));\n"
    "        if (kept.length) reply = kept.join('\\n').trim();\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 真人同场：她说的这句话，同地点的别人也听得见"
)
if old7 in s:
    s = s.replace(old7, new7, 1)
    print('patched: final narration cleanup')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
