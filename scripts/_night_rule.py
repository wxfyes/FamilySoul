import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 有人来提亲：把这件事摆给天道，让它自然提起"
add = """    // 房事规矩（给天道的事实，不是台词）
    try {
      contextHintEarly += '（【房里规矩】夜里不得主动求欢。正妻至多低声问一句"今夜要不要妾身服侍"；侧室、丫鬟一概不许主动提，须相公点名才可近身。谁今夜已经闹过，就记在她名下，两日内不许再提。）\\n';
    } catch { /* 忽略 */ }

""" + anchor
if '【房里规矩】' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('房里规矩提示')
