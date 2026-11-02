import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

old = "function whoSearch() {"
new = "async function whoSearch() {"
if old in s and "async async function whoSearch" not in s:
    s = s.replace(old, new, 1)
    print('restored async on whoSearch')
else:
    print('skip')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
