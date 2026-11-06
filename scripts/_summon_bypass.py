import io
# ① 叫回来要能越过"送客后几小时不许回来"的限制
p = 'src/world/position.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (aw && !String(note || '').includes('送客')) {"""
new = """    const summonBypass = /叫到跟前|厅上候令|听命往某处|都到议事厅/.test(String(note || ''));
    if (aw && !String(note || '').includes('送客') && !summonBypass) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 叫回可越过冷却')

# ② troops 字段修正
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("          troops: Number(f.troops) || 0,", "          troops: Number(f.troops) || Number(f.army) || 0,", 1)
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('② troops 字段')

# ③ 都回来时没人可叫也给提示
p3 = 'src/world/chat-actions.js'
u = io.open(p3, encoding='utf-8-sig').read()
u = u.replace("    if (names.length) notices.push(`${names.join('、')}都到了跟前。`);",
"""    if (names.length) notices.push(`${names.join('、')}都到了跟前。`);
    else if (callAll) notices.push('（内眷已经在跟前了。）');""", 1)
io.open(p3, 'w', encoding='utf-8-sig').write(u)
print('③ 空提示')
