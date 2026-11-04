import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """      const m = t.match(/([\\u4e00-\\u9fa5]{2,4})(阁|房|间|轩|堂|园|楼|居|斋|厅)/);"""
new = """      // 只认"到/去/往/在/回/进/于 + 名 + 屋"这种说法，免得把"茶酒到雅阁"整句当名字
      const SUF = '阁|房|间|轩|堂|园|楼|居|斋|厅';
      let m = t.match(new RegExp(`(?:到|去|往|在|回|进|于|至)([\\\\u4e00-\\\\u9fa5]{2,3})(?:${SUF})`));
      if (m) {
        m = [m[1] + m[0].slice(-1), m[1], m[0].slice(-1)];
      } else {
        // 没有方位词：只取恰好两个字的名字，避免吞掉前面的词
        m = t.match(new RegExp(`([\\\\u4e00-\\\\u9fa5]{2})(?:${SUF})`));
        if (m) m = [m[0], m[1], m[0].slice(-1)];
      }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 收紧屋名识别')
io.open(p, 'w', encoding='utf-8').write(s)
print('done')
