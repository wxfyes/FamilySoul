import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      } finally {
        /* 单次写入口 saveState 已经落盘 */
      }
      // 出口最后一道：别的真人玩家号不许被 AI 代他说话（按数据判定，不写死名字）"""
new = """      } finally {
        /* 单次写入口 saveState 已经落盘 */
      }
      // 体检：本轮耗时记账（只留最近 20 轮）
      try {
        const c = globalThis.__chatStats = globalThis.__chatStats || { n: 0, lastMs: [], maxMs: 0, avgMs: 0 };
        const ms = Date.now() - t0;
        c.n += 1;
        c.lastMs.push(ms);
        if (c.lastMs.length > 20) c.lastMs.shift();
        c.maxMs = Math.max(c.maxMs, ms);
        c.avgMs = Math.round(c.lastMs.reduce((a, b) => a + b, 0) / c.lastMs.length);
      } catch { /* 忽略 */ }
      // 出口最后一道：别的真人玩家号不许被 AI 代他说话（按数据判定，不写死名字）"""
if old in s and '本轮耗时记账' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('本轮耗时记账')
