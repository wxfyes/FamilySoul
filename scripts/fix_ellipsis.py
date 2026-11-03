import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

idx = s.find("const replyEmpty =")
if idx < 0:
    print('WARN: replyEmpty not found')
else:
    end = s.find('\n', idx)
    s = s[:idx] + "const replyEmpty = !String(reply || '').trim() || /^[...\u2026]+$/.test(String(reply || '').trim());" + s[end:]
    print('patched: ellipsis regex covers Chinese ellipsis')

# 移除调试日志
s = s.replace("      console.log('[Proxy] 补代演检查 acc=' + String(this._viewerActorId) + ' empty=' + replyEmpty + ' reply=' + String(reply || '').slice(0, 10));\n", '')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
