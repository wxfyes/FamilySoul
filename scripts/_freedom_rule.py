import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const lines = [];
    const timeCtx = this.getTemporalContext();"""
new = """    const lines = [];
    const timeCtx = this.getTemporalContext();

    // 【最高铁律】玩家的命由玩家定。天道只演世界的反应，不许把人推着走。
    lines.push('【天条·我命由我不由天】');
    lines.push('- 相公想去哪、想做什么、想见谁，统统是他自己的事。你只能写世界对他的回应（谁高兴、谁恼、谁拦、有什么代价），绝不能替他决定路线，也不能写"他只好/他不得不/他别无选择"。');
    lines.push('- 他若不理你铺好的线，那条线就自己走：相关的人照他们的性子等、催、散、另寻他法。世界照转，绝不因为他"没按剧情走"而停摆或硬拽。');
    lines.push('- 你可以示警、可以诱惑、可以设局，但不可替他跨出那一步。他不动，事情就不动。');"""
if old in s and '我命由我不由天' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已加天条')
