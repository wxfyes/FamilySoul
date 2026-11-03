import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      if (isHusAcc && replyEmpty) {"
new = (
    "      console.log('[Proxy] 补代演检查 acc=' + String(this._viewerActorId) + ' empty=' + replyEmpty + ' reply=' + String(reply || '').slice(0, 10));\n"
    "      if (isHusAcc && replyEmpty) {"
)
if old in s and '补代演检查' not in s:
    s = s.replace(old, new, 1)
    print('added debug')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
