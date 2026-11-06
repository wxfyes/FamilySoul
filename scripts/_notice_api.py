import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (merged && merged !== txt) result.reply.text = merged;"""
new = """        if (merged && merged !== txt) result.reply.text = merged;
        // 给客户端留的接口：把【提示】单独抽出来，App 可渲染成系统提示样式
        try {
          const tipLines = String(result.reply?.text || '').split('\\n')
            .filter((ln) => /^【提示】/.test(ln.trim()))
            .map((ln) => ln.replace(/^【提示】/, '').trim())
            .filter(Boolean);
          result.reply.notices = tipLines;
          result.reply.noticeSpeaker = '提示';
        } catch { /* 忽略 */ }"""
if old in s and 'noticeSpeaker' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('notices 字段')
