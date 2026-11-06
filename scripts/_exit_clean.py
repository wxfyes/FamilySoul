import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      console.log(`[ExitProbe] 出口到达"""
new = """      // 出口最后一道观感清理：残缺括号、空的差事回执行
      try {
        let txt = String(result.reply?.text || '');
        txt = txt.split('\\n').filter((ln) => !/^\\s*[^\\n]{0,40}·\\s*限\\d+日）?\\s*$/.test(ln)).join('\\n');
        txt = txt.replace(/[（(]\\s*$/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();
        if (txt) result.reply.text = txt;
      } catch { /* 忽略 */ }
      console.log(`[ExitProbe] 出口到达"""
if old in s and '出口最后一道观感清理' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('出口清残句')
