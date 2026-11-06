import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
# 采样器：30 秒一个点，保留 240 个（2 小时）
anchor = "const server = http.createServer("
if '__perfSeries' not in s.split('const server')[0]:
    add = """// 体检采样：30 秒一个点，留最近 2 小时（只读内存，不碰世界账）
globalThis.__perfSeries = globalThis.__perfSeries || [];
try {
  const __sampler = setInterval(() => {
    try {
      const mem = process.memoryUsage();
      const st = globalThis.__stateStats || {};
      const chat = globalThis.__chatStats || { avgMs: 0, maxMs: 0 };
      const series = globalThis.__perfSeries;
      series.push({
        t: Date.now(),
        rssMB: Math.round(mem.rss / 1048576),
        heapMB: Math.round(mem.heapUsed / 1048576),
        chatMs: Number(chat.avgMs) || 0,
        writes: Number(st.writes) || 0,
        loads: Number(st.loads) || 0,
      });
      if (series.length > 240) series.shift();
    } catch { /* 忽略 */ }
  }, 30000);
  if (typeof __sampler.unref === 'function') __sampler.unref();
} catch { /* 忽略 */ }

"""
    if anchor in s:
        s = s.replace(anchor, add + anchor, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('采样器')
    else:
        print('未找到 server 创建点')
