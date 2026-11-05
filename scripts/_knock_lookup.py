import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          if (atGate && hereK?.parent) {
            const homeK = wK.places?.[hereK.parent];"""
new = """          if (atGate) {
            const homeK = residenceOf(wK, hereK.id) || wK.places?.[hereK.parent];"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 用 residenceOf 找宅子')
