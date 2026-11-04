import io

p = 'web/dashboard.html'
lines = io.open(p, encoding='utf-8').read().split('\n')


def find_block(idname):
    idx = next(i for i, line in enumerate(lines) if ('id="%s"' % idname) in line)
    s = idx
    while s > 0 and '<section' not in lines[s]:
        s -= 1
    depth = 0
    e = s
    while e < len(lines):
        depth += lines[e].count('<section')
        depth -= lines[e].count('</section>')
        if depth == 0 and '</section>' in lines[e] and e > s:
            break
        e += 1
    return s, e


blocks = {k: find_block(k) for k in ('clues', 'timeline', 'events', 'trend')}
for k in sorted(blocks, key=lambda x: blocks[x][0], reverse=True):
    s, e = blocks[k]
    del lines[s:e + 1]

start = next(i for i, line in enumerate(lines) if 'id="tab-overview"' in line)
nxt = None
for i in range(start + 1, len(lines)):
    if 'id="tab-travel"' in lines[i]:
        nxt = i
        break
if nxt is None:
    raise SystemExit('找不到 tab-travel')

close = nxt - 1
while close > start and lines[close].strip() == '':
    close -= 1
print('overview 结束行:', close + 1, '|', lines[close].strip()[:50])

insert = [
    '',
    '        <section class="card full">',
    '          <h2>📜 大事记时间线（天下纪实）</h2>',
    '          <div id="timeline" class="muted" style="margin-top:6px">—</div>',
    '        </section>',
    '        <div class="grid-cards">',
    '          <section class="card">',
    '            <h2>⚡ 最近世界事件</h2>',
    '            <div id="events">—</div>',
    '          </section>',
    '          <section class="card">',
    '            <h2>📈 近 14 日大势走向趋势</h2>',
    '            <div id="trend" style="margin-top:6px">—</div>',
    '          </section>',
    '        </div>',
    '        <section class="card full">',
    '          <h2>🔎 查探线索（底细密辛）</h2>',
    '          <div id="clues">—</div>',
    '        </section>',
]

lines = lines[:close] + insert + lines[close:]
io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('已插入总览页')
