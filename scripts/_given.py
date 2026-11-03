import io
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "            { re: /伙计|小厮|跑堂|丫头|丫鬟|仆/, suffix: '二' },"
new = "            { re: /伙计|小厮|跑堂|丫头|丫鬟|仆/, given: ['春', '桃', '杏', '莲', '福', '安', '喜'] },"
if old in s:
    s = s.replace(old, new, 1)
old2 = "            const fixed = `${sn}${hit ? hit.suffix : '三'}`;"
new2 = (
    "            const givenPool = ['大', '二', '三', '福', '安', '喜', '顺', '春'];\n"
    "            const tail = hit ? (Array.isArray(hit.given) ? hit.given[Math.floor(Math.random() * hit.given.length)] : hit.suffix) : givenPool[Math.floor(Math.random() * givenPool.length)];\n"
    "            const fixed = `${sn}${tail}`;"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('refined given names')
