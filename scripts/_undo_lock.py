import io
# ① 恢复家眷"上街买办"的自由
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      { kind: 'home', text: '去后花园走走，透口气', place: home?.rooms?.garden?.id || null },
"""
new = """      { kind: 'home', text: '去后花园走走，透口气', place: home?.rooms?.garden?.id || null },
      { kind: 'market', text: '上街买些时新果子与针线', place: 'street' },
"""
if old in s and '上街买些时新果子与针线' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 恢复上街')

# ② 撤掉"开聊把人叫到跟前"
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
start = t.find("    // 8.7840 开聊先把同宅内眷请到这间来")
end = t.find("    // 8.7845 同宅女眷在别的屋里应了声", start)
if start > 0 and end > start:
    t = t[:start] + t[end:]
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 撤掉自动叫人')
else:
    print('未找到块', start, end)
