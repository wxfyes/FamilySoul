import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
line = "import { pruneForeignRooms, settleItinerants, buildPremises, buildCourts } from './world/residence.js';\n"
if 'world/residence.js' not in s:
    anchor = "import { visiblePropertiesOf } from './world/employment.js';"
    if anchor in s:
        s = s.replace(anchor, anchor + "\n" + line.rstrip(), 1)
    else:
        first = s.find("\nimport ")
        s = s[:first+1] + line + s[first+1:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('补 residence 导入')
