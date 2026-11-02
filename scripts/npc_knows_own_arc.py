import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 她在场时：把在场者"自己的事"写进上下文
old = "        if (acts.length) bits.push(`他们手头的事：${acts.join('；')}（他们说自己的话时，要跟他们正在做的事对得上）`);"
new = (
    "        if (acts.length) bits.push(`他们手头的事：${acts.join('；')}（他们说自己的话时，要跟他们正在做的事对得上）`);\n"
    "        const own = Object.values(wHere.actors || {})\n"
    "          .filter((a) => a && !a.dead && a.location === locId && a.id !== this._viewerActorId)\n"
    "          .map((a) => ({ name: a.name, step: (wHere.npcArcs || {})[a.id]?.lastStep }))\n"
    "          .filter((x) => x.step)\n"
    "          .slice(0, 4);\n"
    "        if (own.length) {\n"
    "          bits.push(`他们各自正碰上：${own.map((x) => `${x.name}——${x.step}`).join('；')}（他们说话时会带着这桩心事，别装作没事）`);\n"
    "        }"
)
if old in s and '他们各自正碰上' not in s:
    s = s.replace(old, new, 1)
    print('patched: npc own troubles into context')

# ② 代演普通 NPC 时，把他自己的事塞进事实
old2 = "              facts: npcFacts.concat(["
new2 = (
    "              facts: npcFacts.concat([\n"
    "                (wPost.npcArcs || {})[npc.id]?.lastStep\n"
    "                  ? `你眼下自己碰上的事：${wPost.npcArcs[npc.id].lastStep}（说话要带出来）`\n"
    "                  : '',"
)
if old2 in s and '你眼下自己碰上的事' not in s:
    s = s.replace(old2, new2, 1)
    print('patched: proxy npc knows own trouble')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
