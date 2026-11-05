import io, re
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 五处调用都传 hearer（当前说话的人）
subs = [
  ("                 actor: husPost,\n                 memories: hisMem,", "                 actor: husPost,\n                 hearer: mePost,\n                 memories: hisMem,"),
  ("                 actor: npc,\n                 memories: npcMem,", "                 actor: npc,\n                 hearer: mePost,\n                 memories: npcMem,"),
  ("               actor: target,\n               memories: (wN.memories", "               actor: target,\n               hearer: husN,\n               memories: (wN.memories"),
  ("               actor: pickL,\n               memories: (wL.memories", "               actor: pickL,\n               hearer: meL,\n               memories: (wL.memories"),
  ("               actor: who,\n               memories: (wM.memories", "               actor: who,\n               hearer: meM,\n               memories: (wM.memories"),
]
n = 0
for a, b in subs:
    if a in s:
        s = s.replace(a, b, 1)
        n += 1
print('已给', n, '处代演传 hearer')
io.open(p, 'w', encoding='utf-8-sig').write(s)
