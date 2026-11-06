import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
for i, l in enumerate(lines):
    if l.strip() == 'return sendJson(res, 200, { ok: true, text });':
        lines[i] = '      return sendJson(res, 200, { ok: true, text: cleanText });'
        print('修 line', i+1)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
