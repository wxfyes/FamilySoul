import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 体检：历史曲线（内存/聊天耗时），供看板画"心率图" GET /api/admin/perf/history
  if (req.method === 'GET' && pathname === '/api/admin/perf/history') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      return sendJson(res, 200, { ok: true, points: globalThis.__perfSeries || [] });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 体检：极简心率图（SVG，浏览器直接打开） GET /api/admin/perf/chart?token=...
  if (req.method === 'GET' && pathname === '/api/admin/perf/chart') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const pts = (globalThis.__perfSeries || []).slice(-120);
      const W = 640; const H = 160; const P = 8;
      const rss = pts.map((p) => Number(p.rssMB) || 0);
      const chat = pts.map((p) => Number(p.chatMs) || 0);
      const maxR = Math.max(60, ...rss); const maxC = Math.max(1000, ...chat);
      const path = (arr, max) => arr.map((v, i) => {
        const x = P + (i / Math.max(1, arr.length - 1)) * (W - P * 2);
        const y = H - P - (v / max) * (H - P * 2);
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0f172a">
<text x="10" y="16" fill="#94a3b8" font-size="12">内存 RSS（蓝，峰值 ${maxR}MB） / 聊天耗时（红，峰值 ${maxC}ms）</text>
<path d="${path(rss, maxR)}" fill="none" stroke="#38bdf8" stroke-width="2"/>
<path d="${path(chat, maxC)}" fill="none" stroke="#f87171" stroke-width="1.5" opacity="0.9"/>
</svg>`;
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(svg);
      return;
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('历史和心率图接口')
