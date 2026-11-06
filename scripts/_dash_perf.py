import io
p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

nav_anchor = """      <a class="nav-tab" data-tab="tab-system">
        <span class="tab-icon">⚙️</span>
        <span class="tab-label">天机法阵</span>
      </a>"""
nav_add = nav_anchor + """
      <a class="nav-tab" data-tab="tab-perf">
        <span class="tab-icon">📈</span>
        <span class="tab-label">系统检测</span>
      </a>"""
if 'data-tab="tab-perf"' not in s and nav_anchor in s:
    s = s.replace(nav_anchor, nav_add, 1)
    print('① 侧边栏')

pane_anchor = """      <div class="tab-pane" id="tab-system">"""
pane = """      <div class="tab-pane" id="tab-perf">
        <section class="card full">
          <h2>📈 世界心率（服务端实时体检）</h2>
          <div class="muted" style="margin-bottom:10px">每 30 秒采一个点，留最近两小时。读写次数是累计值，看增量。</div>
          <div id="perfCards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:12px">
            <div class="card" style="padding:10px"><div class="muted">内存 RSS</div><div id="perfRss" style="font-size:22px">—</div></div>
            <div class="card" style="padding:10px"><div class="muted">堆内存</div><div id="perfHeap" style="font-size:22px">—</div></div>
            <div class="card" style="padding:10px"><div class="muted">世界账本</div><div id="perfState" style="font-size:22px">—</div></div>
            <div class="card" style="padding:10px"><div class="muted">人数 / 地点</div><div id="perfCounts" style="font-size:22px">—</div></div>
            <div class="card" style="padding:10px"><div class="muted">累计写盘</div><div id="perfWrites" style="font-size:22px">—</div></div>
            <div class="card" style="padding:10px"><div class="muted">聊天均值</div><div id="perfChat" style="font-size:22px">—</div></div>
          </div>
          <canvas id="perfChart" width="1200" height="320" style="width:100%;height:320px;background:#0b1220;border-radius:10px"></canvas>
          <div class="muted" style="margin-top:8px">蓝线：内存 RSS（MB）　红线：聊天平均耗时（ms）</div>
          <div style="margin-top:10px"><button class="btn" onclick="loadPerf()">刷新</button></div>
        </section>
      </div>

""" + pane_anchor
if 'id="tab-perf"' not in s and pane_anchor in s:
    s = s.replace(pane_anchor, pane, 1)
    print('② 页面')

js_anchor = """  // 若切换到行踪，触发一次行踪数据加载
  if (tabId === 'tab-travel' && typeof window.__navLoad === 'function') {
    window.__navLoad();
  }
}"""
js_add = """  // 若切换到行踪，触发一次行踪数据加载
  if (tabId === 'tab-travel' && typeof window.__navLoad === 'function') {
    window.__navLoad();
  }
  // 系统检测：进页即拉一次，页面停留时每 30 秒刷新
  if (tabId === 'tab-perf') {
    loadPerf();
    if (!window.__perfTimer) window.__perfTimer = setInterval(() => {
      if (document.querySelector('.nav-tab.active')?.getAttribute('data-tab') === 'tab-perf') loadPerf();
    }, 30000);
  }
}

async function loadPerf() {
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
  ctx.clearRect(0, 0, W, H);
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
}"""
if 'loadPerf()' not in s and js_anchor in s:
    s = s.replace(js_anchor, js_add, 1)
    print('③ JS')

io.open(p, 'w', encoding='utf-8').write(s)
