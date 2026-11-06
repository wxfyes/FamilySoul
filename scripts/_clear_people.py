import io
# 相公说"清人/都出去/外人出去"：当场把后宅外人请出去
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { knock, grantPass, residenceOf } from './world/visit.js';",
              "import { knock, grantPass, residenceOf } from './world/visit.js';\nimport { evictOutsiders } from './world/privacy.js';", 1)
anchor = "    // 8.9 相公明确说\"你走吧/退下/送客\""
add = """    // 8.8 相公说"清人/都出去/外人出去"：后宅当场清场（不靠谁去传话）
    try {
      if (/清人|清场|都出去|外人出去|打发出去|赶出去|闲杂人等都|不许闲人/.test(String(sayText || ''))) {
        const wE = loadState(this.dataDir);
        const n = evictOutsiders(wE);
        if (n > 0) {
          saveState(this.dataDir, wE);
          reply = String(reply || '') + `\\n（府里把 ${n} 个闲杂人请了出去，后宅清静了。）`;
          console.log(`[Gate] 相公下令清人，清出 ${n} 人`);
        }
      }
    } catch (err) { console.warn('[Gate] 清人失败：', err.message); }

""" + anchor
if '后宅当场清场' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 清人指令生效')
