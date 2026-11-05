import io
# 信息流：天道看得到"近来大事"（世界事件 → 提示词事实）
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'readRecentEvents' not in s:
    # 找到 state.js 的 import 行追加
    for cand in ("import { loadState, saveState } from './world/state.js';",
                 "import { loadState } from './world/state.js';"):
        if cand in s:
            s = s.replace(cand, cand.replace('}', ', readRecentEvents }'), 1)
            break
    print('① 引入 readRecentEvents')

anchor = "    // 在场者的底细：他有没有成婚、住哪、在哪当差——谁问都得对得上"
block = """    // 近来大事：世界在自己走，相公得知道外头发生了什么（不弹窗，靠人嘴说）
    try {
      const recent = readRecentEvents(this.dataDir, 6) || [];
      const lines = recent
        .map((e) => {
          const t = e?.payload?.text || e?.text || '';
          if (!t) return '';
          const day = e?.day != null ? `第${e.day}日` : '';
          return `${day}${t}`;
        })
        .filter(Boolean)
        .slice(-4);
      if (lines.length) {
        contextHintEarly += `（【近来天下大事】${lines.join('；')}。这些事已经发生，相公或身边人可能听说；若有人问起，照此说，不许另编更离奇的。）\\n`;
      }
    } catch { /* 忽略 */ }

""" + anchor
if '【近来天下大事】' not in s:
    s = s.replace(anchor, block, 1)
    print('② 注入近来大事')
io.open(p, 'w', encoding='utf-8-sig').write(s)
