import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

code = r'''
// ── 卡片折叠：默认收起"不常看"的卡，点标题展开 ─────────────────
(function initCardCollapse() {
  const DEFAULT_CLOSED = [
    '朝中', '天下（行会', '势力与兵力', '天下（城池', '山川', '基础设施', '产业表',
    '人物', '天机', '她们亲口说过的话', '最近事件', '趋势', '盘点',
    '系统诊断', '成员绑定', '真人', '家底', '清空记忆',
  ];
  const KEY = 'fs-dash-collapsed';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }

  function apply() {
    document.querySelectorAll('main section.card').forEach(sec => {
      if (sec.id === 'morning-banner') return;
      const h2 = sec.querySelector('h2');
      if (!h2) return;
      const title = (h2.textContent || '').trim();

      // 把 h2 之外的内容包进 body（只做一次）
      let body = sec.querySelector(':scope > .card-body');
      if (!body) {
        body = document.createElement('div');
        body.className = 'card-body';
        [...sec.childNodes].forEach(n => { if (n !== h2) body.appendChild(n); });
        sec.appendChild(body);
      }

      // 点击标题折叠/展开
      if (!h2.dataset.bound) {
        h2.dataset.bound = '1';
        h2.style.cursor = 'pointer';
        h2.title = '点击折叠 / 展开';
        h2.addEventListener('click', () => {
          const collapsed = sec.classList.toggle('collapsed');
          saved[title] = collapsed;
          try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
        });
      }

      // 初值：用户手动设过就按用户的，否则按默认表
      if (!(title in saved)) {
        const shouldClose = DEFAULT_CLOSED.some(k => title.includes(k));
        saved[title] = shouldClose;
      }
      sec.classList.toggle('collapsed', Boolean(saved[title]));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
  window.__applyCardCollapse = apply;
})();
'''

# 在最后一个 </script> 前插入
idx = s.rfind('</script>')
if idx < 0:
    print('WARN: 没有 script 结束标签')
else:
    s = s[:idx] + code + '\n' + s[idx:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已插入折叠脚本')

# 样式
css = """
main section.card.collapsed > .card-body { display: none; }
main section.card > h2 { user-select: none; }
main section.card.collapsed > h2::after { content: '　▸'; opacity: .5; font-size: 12px; }
main section.card:not(.collapsed) > h2::after { content: '　▾'; opacity: .35; font-size: 12px; }
"""
s2 = io.open(p, encoding='utf-8').read()
if 'section.card.collapsed' not in s2:
    s2 = s2.replace('</style>', css + '</style>', 1)
    io.open(p, 'w', encoding='utf-8').write(s2)
    print('已插入折叠样式')
