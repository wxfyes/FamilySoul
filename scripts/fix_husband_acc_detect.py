import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      if (!this._viewerActorId && /^\\.{2,}$/.test(String(reply || '').trim()) || (!this._viewerActorId && !String(reply || '').trim())) {"
new = (
    "      const isHusAcc = !this._viewerActorId || this._viewerActorId === 'husband';\n"
    "      const replyEmpty = !String(reply || '').trim() || /^\\.{2,}$/.test(String(reply || '').trim());\n"
    "      if (isHusAcc && replyEmpty) {"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: husband account detection')
else:
    print('WARN: condition not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
