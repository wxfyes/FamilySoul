import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "      // 送客（真出口，所有写盘之后）：把在场该走的人送到他们自己的住处"
new = "      console.log(`[ExitProbe] 出口到达 text=${String(body.text||'').slice(0,20)} actor=${currentMember.actor}`);\n      // 送客（真出口，所有写盘之后）：把在场该走的人送到他们自己的住处"
if old in s and 'ExitProbe' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('probe added')
