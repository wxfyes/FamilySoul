import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 把天条从开头挪走
block = """    // 【最高铁律】玩家的命由玩家定。天道只演世界的反应，不许把人推着走。
    lines.push('【天条·我命由我不由天】');
    lines.push('- 相公想去哪、想做什么、想见谁，统统是他自己的事。你只能写世界对他的回应（谁高兴、谁恼、谁拦、有什么代价），绝不能替他决定路线，也不能写"他只好/他不得不/他别无选择"。');
    lines.push('- 他若不理你铺好的线，那条线就自己走：相关的人照他们的性子等、催、散、另寻他法。世界照转，绝不因为他"没按剧情走"而停摆或硬拽。');
    lines.push('- 你可以示警、可以诱惑、可以设局，但不可替他跨出那一步。他不动，事情就不动。');
"""
if block in s:
    s = s.replace(block, "", 1)
    print('① 从天条开头挪走')

# 插到【天机】摘要之前（静态区末尾）
marker = "        lines.push('【天机" if "        lines.push('【天机" in s else None
if marker:
    s = s.replace(marker, block + marker, 1)
    print('② 插到天机之前')
else:
    # 找不到就插到 lines 数组 push 完静态块的位置：找 '【天道回执' 之前
    m2 = "    lines.push('【天道回执"
    if m2 in s:
        s = s.replace(m2, block + m2, 1)
        print('② 插到天道回执之前')

io.open(p, 'w', encoding='utf-8').write(s)
