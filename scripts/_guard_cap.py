import io
p = 'src/world/chat-actions.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    notices.push(names.length ? `${names.join('、')}到了议事厅候令。` : '（宅里此刻没有当差的护院家丁。）');"""
new = """    notices.push(names.length
      ? (names.length > 6 ? `${names.slice(0, 6).join('、')}等 ${names.length} 人到了议事厅候令。` : `${names.join('、')}到了议事厅候令。`)
      : '（宅里此刻没有当差的护院家丁。）');"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('人数收口')
