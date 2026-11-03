with open('web/dashboard.html', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    if (otherProps.length > 0) {
      accHtml += `<div class="muted" style="margin:8px 0 2px;font-size:12px;">眷属私产（独立核算·不入公账）</div>`;
      accHtml += otherProps.map(p => {
        const ownerName = p.ownerName || p.keeperName || '眷属';
        return `<div class="row">
          <span>${p.name} <span class="muted">(${ownerName}私产)</span></span>
          <span class="num" style="color:#a78bfa;">+${(Number(p.incomePerDay) || 0).toFixed(1)} 两/日</span>
        </div>`;
      }).join('');
    }'''

replacement = '''    if (otherProps.length > 0) {
      accHtml += `<div class="muted" style="margin:8px 0 2px;font-size:12px;">眷属私产（独立核算·不入公账）</div>`;
      accHtml += otherProps.map(p => {
        const ownerId = p.owner || p.keeper;
        const ownerName = p.ownerName || p.keeperName || (w.actors?.[ownerId]?.name) || '眷属';
        const privatePurse = Number(w.wallets?.[ownerId] ?? 0);
        return `<div class="row">
          <span>${p.name} <span class="muted">(${ownerName}私产 · 私房存银 ${privatePurse.toFixed(1)}两)</span></span>
          <span class="num" style="color:#a78bfa;">+${(Number(p.incomePerDay) || 0).toFixed(1)} 两/日</span>
        </div>`;
      }).join('');
    }'''

if target in text:
    text = text.replace(target, replacement)
    with open('web/dashboard.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully updated web/dashboard.html")
else:
    print("Target not found in web/dashboard.html")

