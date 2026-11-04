import io
# ① 说话人：正文里出现【某人】：就取那个人；没有才用 spawn 的人 / 旁白
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const speakerMatch = cleanText.match(/【([^】]{1,8})】：/);
        const speaker = speakerMatch ? speakerMatch[1] : (spawnedName || '旁白');"""
new = """        // 说话人：优先取正文里第一个【某人】：；其次取天道声明要立的人；最后才是旁白
        const allSpeakers = [...cleanText.matchAll(/【([^】]{1,8})】：/g)].map((mm) => mm[1].trim()).filter(Boolean);
        const speaker = allSpeakers[0] || spawnedName || '旁白';"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 说话人取正文第一个')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② 天道规矩：可以补白，不可以补"你的过去/你的亲属"
p2 = 'src/world/opening.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "    '6. 字数 120~220 字。',"
add = """    '7. 可以补白：光影、天气、街上的动静、桌上的旧物。',
    '8. 绝不许补白：他的亲属、他的过往、他没做过的事。这些只有账本上有的才算。',
    '6. 字数 120~220 字。',"""
if anchor in t and '绝不许补白' not in t:
    t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 补白边界写进规矩')
