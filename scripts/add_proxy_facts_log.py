import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "            const pp = buildProxyPrompt({"
new = (
    "            console.log('[Proxy] 事实' + facts.length + '条：' + facts.slice(-4).join(' ｜ ').slice(0, 160));\n"
    "            const pp = buildProxyPrompt({"
)
if old in s and "[Proxy] 事实" not in s:
    s = s.replace(old, new, 1)
    print('added facts logging')
else:
    print('WARN: anchor not found or already logging')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
