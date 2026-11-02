import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

# ① 城中动静卡片：插在「势力与兵力」之后（和真人/体检/势力同一排，自动换行）
if 'id="npcarcs"' not in s:
    anchor = "    <div class=\"row\"><span>朝廷压力</span><span id=\"m-pressure\">—</span></div>\n  </section>"
    card = anchor + (
        "\n\n  <section class=\"card\">\n"
        "    <h2>城中动静（各人自己的事）</h2>\n"
        "    <div id=\"npcarcs\" class=\"muted\" style=\"margin-top:6px\">—</div>\n"
        "  </section>"
    )
    if anchor in s:
        s = s.replace(anchor, card, 1)
        print('added npcarcs card in row')
    else:
        print('WARN: 势力 anchor not found')

# ② 成员绑定：只显示"已绑定"的，其余折起来
old_render = "$('bind').innerHTML = list.map(m => {"
if old_render not in s:
    old_render = "$('bind').innerHTML = rows.map(m => {"
if old_render not in s:
    print('WARN: bind render not found')
else:
    # 找到 bind 渲染后插入过滤逻辑较复杂，改为在渲染时用 bound 标记 + 展开开关
    print('bind render found, will patch inside')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
