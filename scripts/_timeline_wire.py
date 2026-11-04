import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'events-view.js' not in s:
    s = s.replace("import { moveActor } from './world/position.js';",
                  "import { moveActor } from './world/position.js';\nimport { buildTimeline } from './world/events-view.js';", 1)
    print('引入 timeline')

# 世界 payload 里加 timeline（人话版）
old = "  recentEvents:"
i = s.find(old)
if i > 0:
    # 找到 recentEvents 赋值行，紧随其后插入 timeline
    line_end = s.find('\n', i)
    ins = "\n  timeline: buildTimeline(world, (world.__recent || []), 14),"
    # 用最近事件源：payload 里应已有 recentEvents 变量，这里直接用其来源
    s = s[:line_end] + ins + s[line_end:]
    print('payload 插入 timeline（待接数据源）')
io.open(p, 'w', encoding='utf-8-sig').write(s)
