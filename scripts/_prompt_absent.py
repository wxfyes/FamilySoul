import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            '**谁在场，就由谁开口**；不在场的人不会说话，也不能凭空出现。',"""
new = """            '**谁在场，就由谁开口**；不在场的人不会说话，也不能凭空出现。',
            '**提到不在场的人（比如王掌柜）时，只能由在场的人转述"他怎样怎样"，绝对不许给他写【某某】：的台词**——写了也会被引擎整段删掉。',"""
if old in s and '写了也会被引擎整段删掉' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 提示词加"不许给不在场的人写台词"')
