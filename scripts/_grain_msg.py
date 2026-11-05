import io
# ① 服务端：粮不够时把话说全
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "  if (!f || f.grain < grainNeeded) return { ok: false, error: `粮不够：${come} 人要 ${grainNeeded} 石` };"
if old not in s:
    import re
    m = re.search(r"return \{ ok: false, error: `粮不够：[^`]*` \};", s)
    if m:
        s = s.replace(m.group(0), "return { ok: false, error: `粮不够：${come} 人要 ${grainNeeded} 石（府库只剩 ${f?.grain || 0} 石，先去购粮）` };")
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('① 粮不够提示补全')
    else:
        print('未匹配到粮不够语句')
else:
    print('已改过')
