import io

# ============ ① 服务端：常来往（好友）名单 ============
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """        // 可找的人：府内 / 相好 / 其他"""
new = """        // 常来往：关系网里处得来的人（不是仇家），加进"找人"的第一组
        const friendIds = new Set();
        try {
          const myBonds = world.bonds?.[actorId] || {};
          for (const [otherId, b] of Object.entries(myBonds)) {
            if (!b || b.type === '仇家' || b.type === '主仆') continue;
            if (Number(b.score) >= 20 && world.actors?.[otherId] && !world.actors[otherId].dead) friendIds.add(otherId);
          }
        } catch { /* 忽略 */ }

        // 可找的人：府内 / 相好 / 其他"""
if old in s and 'friendIds' not in s:
    s = s.replace(old, new, 1)
    print('① 计算常来往')

# 分组里加"常来往"
old2 = """        const group = (a) => {
          if (isHusbandViewer) {
            if (a.household) return '府内';
            return isIntimate(a) ? '相好' : '其他人';
          }"""
new2 = """        const group = (a) => {
          if (isHusbandViewer) {
            if (a.household) return '府内';
            if (isIntimate(a)) return '相好';
            if (friendIds.has(a.id)) return '常来往';
            return '其他人';
          }"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 分组加常来往')

# 排序权重
old3 = """            const o = isHusbandViewer
              ? { 府内: 0, 相好: 1, 其他人: 2 }
              : { 我的人: 0, 王家: 1, 其他人: 2 };"""
new3 = """            const o = isHusbandViewer
              ? { 府内: 0, 相好: 1, 常来往: 2, 其他人: 3 }
              : { 我的人: 0, 王家: 1, 常来往: 2, 其他人: 3 };"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 排序加常来往')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
