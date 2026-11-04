import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old_block_start = "    // 【最高铁律】玩家的命由玩家定。天道只演世界的反应，不许把人推着走。"
i = s.find(old_block_start)
if i < 0:
    print('WARN: 天条没找到')
else:
    j = s.find("他不动，事情就不动。');", i)
    j = s.find('\n', j) + 1
    compact = """    // 【最高铁律】玩家自由：不替他决定、不逼他走线
    lines.push('【天条】相公的路他自己走。你只写世界的反应与代价（谁喜谁恼、谁拦谁散），不许替他决定，也不许写"他只好/别无选择"。他不理你铺的线，那条线就自己走。');
"""
    s = s[:i] + compact + s[j:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已压缩为一行')
