import io

# ① 造物门改用 naming.js 的规则（不再堆 if 黑名单）
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """          const valid = /^[\\u4e00-\\u9fa5]{2,6}$/.test(rawName)
            && !/(什么|哪|这里|那里|某|一个|怎么|如何|是否|到底)/.test(rawName)
            && !/(去|来|走|到|找|说|看|上|下|里|外|前|后|旁|中|间|边)/.test(rawName.slice(0, 1))
            && !/^(上方|下方|上面|下面|左边|右边|旁边|中间|里头|外头|前面|后面|里面|外面|这里|那里|上头|下头)$/.test(rawName);
          if (!valid) { console.log(`[Build] 名字「${rawName}」不像地名，驳回`); continue; }"""
new = """          const verdict = isPlaceName(rawName);
          if (!verdict.ok) { console.log(`[Build] 名字「${rawName}」不像地名（${verdict.why}），驳回`); continue; }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 造物门改用 naming 规则')

# 引入
if 'naming.js' not in s:
    anchor = "import { applySummon }"
    if anchor in s:
        s = s.replace(anchor, "import { isPlaceName, extractPlaceCandidates } from './world/naming.js';\n" + anchor, 1)
    else:
        # 放在第一个 import 之后
        idx = s.find('\n', s.find('import '))
        s = s[:idx+1] + "import { isPlaceName, extractPlaceCandidates } from './world/naming.js';\n" + s[idx+1:]
    print('② 引入 naming')

io.open(p, 'w', encoding='utf-8').write(s)

# ③ server 的 placeFromText 也走同一套规则
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """      if (roomName) {"""
new2 = """      if (roomName && !isPlaceName(roomName).ok) roomName = null;
      if (roomName) {"""
if old2 in t and 'isPlaceName(roomName)' not in t:
    t = t.replace(old2, new2, 1)
    print('③ 原文认地点也验名')

if 'naming.js' not in t:
    t = t.replace("import { moveActor } from './world/position.js';",
                  "import { moveActor } from './world/position.js';\nimport { isPlaceName } from './world/naming.js';", 1)
    print('④ server 引入 naming')
io.open(p2, 'w', encoding='utf-8').write(t)
print('done')
