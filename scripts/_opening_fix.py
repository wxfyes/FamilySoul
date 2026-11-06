import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 过门人就在玩家眼前（不是被挪去街上）
old = """            const nearId = isHomeOfPlayer ? 'street' : (world.places?.[a.location] && !world.places[a.loc"""
new = """            const nearId = String(a.location || 'street');"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 过门人就在玩家所在地')

# ② 拆段存历史：旁白一段、每个人一段
old2 = """        const speakerMatch0 = cleanText.match(/【([^】]{1,8})】：/);
        msgs.push({
          role: 'assistant',
          text: cleanText,
          speaker: speakerMatch0 ? speakerMatch0[1] : (spawnedName || '旁白'),
          at: Date.now(),
        });"""
new2 = """        // 按【说话人】拆开存：旁白归旁白，人物归人物，客户端才会分成两个气泡
        const parts = cleanText.split(/(?=【[^】\\n]{1,12}】)/).map((x) => x.trim()).filter(Boolean);
        for (const part of parts) {
          const m0 = /^【([^】\\n]{1,12})】/.exec(part);
          msgs.push({
            role: 'assistant',
            text: part,
            speaker: m0 ? m0[1] : '旁白',
            at: Date.now(),
          });
        }"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 开场拆段存历史')

# ③ 返回洗净的正文
s = s.replace("      return sendJson(res, 200, { ok: true, text });",
              "      return sendJson(res, 200, { ok: true, text: cleanText });", 1)
print('③ 返回 cleanText')
io.open(p, 'w', encoding='utf-8-sig').write(s)
