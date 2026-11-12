import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 1) 触发条件：不再要求"他在同一个地方"
old = "        if (husHere && askedHim && !/【[^】]*王甯/.test(String(reply))) {"
new = "        if (askedHim && !/【[^】]*王甯/.test(String(reply))) {"
if old in s:
    s = s.replace(old, new)
    print('patched: proxy no longer requires co-location')
else:
    print('WARN: proxy trigger not found')

# 2) 他不在跟前时，提示里说明是"捎话/隔空"，不要写成就在同一间屋
old2 = "              hearerPlace: String(wPost.places?.[locPost]?.name || ''),"
new2 = (
    "              hearerPlace: husHere\n"
    "                ? String(wPost.places?.[locPost]?.name || '')\n"
    "                : `${String(wPost.places?.[locPost]?.name || '')}（他人在「${String(wPost.places?.[husPost?.location]?.name || '别处')}」，这是托人捎话/隔空应答，不要写成他就在同一间屋里）`,"
)
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: remote context for proxy')
else:
    print('WARN: hearerPlace line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
