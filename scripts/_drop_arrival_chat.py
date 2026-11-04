import io
# ① 去掉聊天里自动插入的"你到了"整行
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find('    // 换地方了：在回复末尾补一行"你到了"')
if start < 0:
    print('WARN: 到达行块没找到')
else:
    end = s.find('    this.saveHistory(profileKey, history);', start)
    if end < 0:
        print('WARN: 结束点没找到')
    else:
        s = s[:start] + s[end:]
        io.open(p, 'w', encoding='utf-8').write(s)
        print('① 已删除聊天里的"你到了"旁白')
