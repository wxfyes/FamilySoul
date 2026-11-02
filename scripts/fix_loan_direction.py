import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "          text: `${world.actors[toId]?.name || '她'}借${world.actors[fromId]?.name || '相公'}${amount}两，约定第${dueDay}日归还`,"
new = "          text: `${world.actors[fromId]?.name || '相公'}借给${world.actors[toId]?.name || '她'}${amount}两（${world.actors[toId]?.name || '她'}欠${world.actors[fromId]?.name || '相公'}），第${dueDay}日还清`,"
if old in s:
    s = s.replace(old, new)
    print('patched: promise wording unambiguous')
else:
    print('WARN: promise text not found')

old2 = "        world.memories.push({ text: `${world.actors[fromId]?.name || '相公'}借给${world.actors[toId]?.name || '她'}${amount}两`, day: world.clock.day, at: Date.now(), about: [toId], visible: 'private' });"
new2 = "        world.memories.push({ text: `${world.actors[fromId]?.name || '相公'}借给${world.actors[toId]?.name || '她'}${amount}两，${world.actors[toId]?.name || '她'}欠着`, day: world.clock.day, at: Date.now(), about: [toId], visible: 'private' });"
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: memory wording')

io.open(p, 'w', encoding='utf-8').write(s)

# 代演提示：把借贷方向讲明白
p2 = 'src/world/proxy-actor.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old3 = "    facts.length ? `与他有关的硬事实（必须照这个答，不许否认）：${facts.slice(-8).join('；')}` : '',"
new3 = (
    "    facts.length ? `与他有关的硬事实（必须照这个答，不许否认）：${facts.slice(-8).join('；')}` : '',\n"
    "    '注意借贷方向：写「A 借给 B」＝ A 出钱、B 欠钱；「B 欠 A」＝ 该还的是 B。别把方向搞反。',"
)
if old3 in s2 and '借贷方向' not in s2:
    s2 = s2.replace(old3, new3)
    print('patched: proxy direction hint')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
