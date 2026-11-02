import io

p = 'src/world/proxy-actor.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    `对${hearerName || '对方'}的态度：信任${rel.trust ?? 50}、欲望${rel.desire ?? 0}、怨怼${rel.grievance ?? 0}。`,"
new = "    // 态度改由调用方以「硬事实」传入，避免两处数字打架"
if old in s:
    s = s.replace(old, new)
    print('removed duplicate attitude line')
else:
    print('WARN: attitude line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
