import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 送客/回房：认"X回房间/回房去/回去歇着"这种说法，并按点名的人走
old = """        || /叫他们.{0,4}(走|回去|出去)|都回(房|屋|去)|散了吧|退下/.test(String(sayText || ''));"""
new = """        || /叫他们.{0,4}(走|回去|出去)|都回(房|屋|去)|散了吧|退下/.test(String(sayText || ''))
        || /(?:回|进)(?:房|屋)(?:间|去|里)?|回去歇着|各自回/.test(String(sayText || ''));"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 回房话术')

# ② 点名的只走被点名的人
old2 = """        // 妻妾丫鬟也要真的回自己房里去，不再"嘴上告退、人还在"
        const goers0 = hereF.slice();"""
new2 = """        // 话里点了名的，只走被点名的；没点名才清场
        const named = Object.values(wF.actors || {}).filter((a) => a && !a.dead && a.name
          && a.location === meF?.location && String(sayText || '').includes(a.name));
        const goers0 = named.length ? named : hereF.slice();"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 点名只走点名的人')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ③ 提示词：不许出现"客卿/府中/系统"这种旁白式说话人
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "lines.push('- 【离场要写标签】"
if anchor in t and '客卿' not in t:
    add = """lines.push('- 【说话人只能是场上的人】：绝不出现"客卿""府中""系统""数据库"这类旁白式说话人；不在场的人不许开口，也不许替世界报账。');
"""
    t = t.replace(anchor, add + anchor, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('③ 禁旁白说话人')
