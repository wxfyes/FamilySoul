import io
old = io.open('.tmp_head_server.js', encoding='utf-8-sig').read().split('\n')
cur = io.open('src/server.js', encoding='utf-8-sig').read().split('\n')

# 旧文件里 /api/me 的起点与终点
start = None
for i, l in enumerate(old):
    if "pathname === '/api/me'" in l:
        start = i
        break
end = None
for j in range(start + 1, len(old)):
    if old[j].startswith('  // ── 行踪簿'):
        end = j
        break
print('旧 /api/me 块:', start + 1, '→', end + 1, '共', end - start, '行')

block = old[start:end]
# 插到当前文件的"行踪簿"注释之前
ins = None
for i, l in enumerate(cur):
    if l.startswith('  // ── 行踪簿'):
        ins = i
        break
print('插入点:', ins + 1)
cur = cur[:ins] + block + cur[ins:]
io.open('src/server.js', 'w', encoding='utf-8').write('\n'.join(cur))
print('已补回 /api/me')
