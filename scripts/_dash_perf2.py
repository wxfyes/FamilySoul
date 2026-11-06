import io
p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()
anchor = "function initTabs() {"
js = """async function loadPerf() {
  const tk = token();
  if (!tk) return;
  try {
    const [snap, hist] = await Promise.all([
      fetch(`/api/admin/perf?token=${encodeURIComponent(tk)}`).then((r) => r.json()),
      fetch(`/api/admin/perf/history?token=${encodeURIComponent(tk)}`).then((r) => r.json()),
    ]);
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('perfRss', `${snap.rssMB} MB`);
    setTxt('perfHeap', `${snap.heapMB} MB`);
    setTxt('perfState', `${snap.stateMB} MB`);
    setTxt('perfCounts', `${snap.actors} / ${snap.places}`);
    setTxt('perfWrites', `${snap.state?.writes ?? 0}`);
    setTxt('perfChat', snap.chat?.avgMs ? `${snap.chat.avgMs} ms` : '—');
    drawPerfChart(hist.points || []);
  } catch (e) { console.warn('perf 加载失败', e); }
}

function drawPerfChart(points) {
  const cv = document.getElementById('perfChart');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const W = cv.width; const H = cv.height; const P = 36;
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);
  if (!points.length) {
    ctx.fillStyle = '#64748b'; ctx.font = '16px sans-serif'; ctx.fillText('还没有采样点，等 30 秒再来', P, H / 2);
    return;
  }
  const rss = points.map((p) => Number(p.rssMB) || 0);
  const chat = points.map((p) => Number(p.chatMs) || 0);
  const maxR = Math.max(60, ...rss); const maxC = Math.max(500, ...chat);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = P + (i / 4) * (H - P * 2);
    ctx.beginPath(); ctx.moveTo(P, y); ctx.lineTo(W - P, y); ctx.stroke();
  }
  const line = (arr, max, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    arr.forEach((v, i) => {
      const x = P + (i / Math.max(1, arr.length - 1)) * (W - P * 2);
      const y = H - P - (v / max) * (H - P * 2);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
  };
  line(rss, maxR, '#38bdf8');
  line(chat, maxC, '#f87171');
  ctx.fillStyle = '#94a3b8'; ctx.font = '12px sans-serif';
  ctx.fillText(`内存峰值 ${maxR}MB`, P, 18);
  ctx.fillText(`聊天峰值 ${maxC}ms`, P + 140, 18);
}

""" + anchor
if 'async function loadPerf' not in s and anchor in s:
    s = s.replace(anchor, js, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('插入 JS 函数')

# 切换钩子
hook_old = """  if (tabId === 'tab-travel' && typeof window.__navLoad === 'function') {
    window.__navLoad();
  }"""
hook_new = hook_old + """
  if (tabId === 'tab-perf') {
    loadPerf();
    if (!window.__perfTimer) window.__perfTimer = setInterval(() => {
      const act = document.querySelector('.nav-tab.active');
      if (act && act.getAttribute('data-tab') === 'tab-perf') loadPerf();
    }, 30000);
  }"""
if '__perfTimer' not in s and hook_old in s:
    s = s.replace(hook_old, hook_new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('切换钩子')
