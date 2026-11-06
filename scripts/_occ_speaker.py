import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { describeRoom, roomForHour } from './world/room-life.js';",
              "import { describeRoom, roomForHour } from './world/room-life.js';\nimport { titleOf } from './world/occupation.js';", 1)
old = """        const role = String(a.role || '').trim() || (a.humanBound ? '游侠' : '');"""
new = """        const role = String(a.title || a.role || '').trim() || (a.humanBound ? '布衣' : '');"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('② 说话人标签优先用 title')
