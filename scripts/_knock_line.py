import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        const line = `（你到了「${placeName2}」。${hereList.length ? '此处：' + hereList.join('，') + '。' : '此处无人。'}"
new = "        const line = `${knockLine}（你到了「${placeName2}」。${hereList.length ? '此处：' + hereList.join('，') + '。' : '此处无人。'}"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 门房的话并进入场行')
