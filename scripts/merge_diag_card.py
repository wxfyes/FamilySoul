import io, re

p = 'web/dashboard.html'
lines = io.open(p, encoding='utf-8').read().split('\n')

def find_section(title_kw):
    for i, l in enumerate(lines):
        if re.match(r'\s*<section class="card', l):
            for j in range(i, min(i + 3, len(lines))):
                m = re.search(r'<h2>(.*?)</h2>', lines[j])
                if m and title_kw in re.sub(r'<[^>]+>', '', m.group(1)):
                    e = None
                    for k in range(i, min(i + 40, len(lines))):
                        if lines[k].strip() == '</section>':
                            e = k
                            break
                    return i, e
    return None, None

blocks = {}
for kw in ['运行状态', '花费', '体检结果']:
    s, e = find_section(kw)
    if s is None:
        print(f'WARN: 没找到「{kw}」')
        continue
    inner = lines[s:e + 1]
    # 去掉 <section ...> 与 </section>，去掉 <h2> 行（另起小标题）
    inner = inner[1:-1]
    inner = [x for x in inner if not re.search(r'<h2>', x)]
    blocks[kw] = inner

if len(blocks) == 3:
    s1, e1 = find_section('运行状态')
    s3, e3 = find_section('体检结果')
    # 三块必须连续：先删后插
    merged = []
    merged.append('<section class="card" id="card-diag">')
    merged.append('  <h2>🩺 系统诊断</h2>')
    merged.append('  <div class="muted" id="diag-summary" style="margin:4px 0 6px">点开看：运行状态 · 花费 · 体检结果</div>')
    merged.append('  <details>')
    merged.append('    <summary style="cursor:pointer;font-size:12px;opacity:.8">展开明细</summary>')
    for title, key in [('运行状态', '运行状态'), ('花费', '花费'), ('体检结果', '体检结果')]:
        merged.append(f'    <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06)">')
        merged.append(f'      <div class="muted" style="margin-bottom:4px">{title}</div>')
        merged.extend(blocks[key])
        merged.append('    </div>')
    merged.append('  </details>')
    merged.append('</section>')

    lines = lines[:s1] + merged + lines[e3 + 1:]
    print('已合并三张诊断卡为一张折叠卡')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('done')
