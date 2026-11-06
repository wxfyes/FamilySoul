import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      } finally {
        /* 单次写入口 saveState 已经落盘 */
      }"""
new = """      } finally {
        /* 单次写入口 saveState 已经落盘 */
      }
      // 体检：记录每轮耗时（只留最近 20 条）
      try {
        globalThis.__chatStats = globalThis.__chatStats || { n: 0, lastMs: [], maxMs: 0, avgMs: 0 };
        const ms = Date.now() - t0;
        const c = globalThis.__chatStats;
        c.n += 1;
        c.lastMs.push(ms);
        if (c.lastMs.length > 20) c.lastMs.shift();
        c.maxMs = Math.max(c.maxMs, ms);
        c.avgMs = Math.round(c.lastMs.reduce((a, b) => a + b, 0) / c.lastMs.length);
      } catch { /* 忽略 */ }"""
if old in s and '__chatStats' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('chat 计时')
