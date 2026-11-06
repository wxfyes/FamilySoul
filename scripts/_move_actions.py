import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
markers = [
 '// 8.7845 都到议事厅',
 '// 8.7848 叫人来',
 '// 8.785 营生三件事',
 '// 8.7851 "就按你说的办"',
 '// 8.7853 经营动作',
 '// 8.7855 货与赌',
]
removed = []
for m in markers:
    start = s.find('    ' + m)
    if start < 0:
        start = s.find(m)
    if start < 0:
        continue
    nxt = s.find('\n    // 8.', start + len(m))
    if nxt < 0:
        continue
    s = s[:start] + s[nxt+1:]
    removed.append(m)
# 补 import + 主流程调用
s = s.replace("import { startTradeRun, startNightMarket, drainBizNotices } from './world/business.js';",
              "import { startTradeRun, startNightMarket, drainBizNotices } from './world/business.js';\nimport { applyChatActions } from './world/chat-actions.js';", 1)
old = "    reply = this.processNarrativeTags(reply, say);"
new = """    reply = this.processNarrativeTags(reply, say);
    // 世界动作走单一入口：执行完把【提示】拼回最终回复
    try {
      const wAct = loadState(this.dataDir);
      const ns = applyChatActions({ world: wAct, viewerId: this._viewerActorId || 'husband', sayText: say });
      if (ns && ns.length) {
        saveState(this.dataDir, wAct);
        reply += '\\n' + ns.map((t) => `【提示】${t}`).join('\\n');
        console.log(`[Actions] ${ns.length} 条提示已并入回复`);
      }
    } catch (err) { console.warn('[Actions] 执行失败：', err.message); }"""
if old in s and 'applyChatActions({' not in s:
    s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('移除旧块:', removed)
