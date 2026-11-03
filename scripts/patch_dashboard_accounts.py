with open('web/dashboard.html', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

old_acc = """  // ── 💰 账目卡 ──────────────────────────────
  if ($('card-accounts')) {
    const silver = Number(w.assets?.silver ?? 0);
    const props = (w.assets?.properties || []).filter(p => (Number(p.incomePerDay) || 0) > 0 || p.keeperName);
    const income = props.reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0);
    $('a-acc-top').textContent = `现存 ${silver.toFixed(1)} 两 · 日入 ${income.toFixed(1)} 两`;
    let accHtml = '';
    accHtml += props.map(p => {
      const keeper = p.keeperName ? ` <span class="muted">(${p.keeperName}当家)</span>` : '';
      return `<div class="row">
        <span>${p.name}${keeper}</span>
        <span class="num good">+${(Number(p.incomePerDay) || 0).toFixed(1)} 两/日</span>
      </div>`;
    }).join('');"""

new_acc = """  // ── 💰 账目卡 ──────────────────────────────
  if ($('card-accounts')) {
    const silver = Number(w.assets?.silver ?? 0);
    const allProps = (w.assets?.properties || []).filter(p => (Number(p.incomePerDay) || 0) > 0 || p.keeperName);
    const husbandProps = allProps.filter(p => p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper));
    const otherProps = allProps.filter(p => !(p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper)));
    const income = husbandProps.reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0);
    $('a-acc-top').textContent = `现存 ${silver.toFixed(1)} 两 · 日入 ${income.toFixed(1)} 两`;
    let accHtml = '';
    accHtml += husbandProps.map(p => {
      const keeper = p.keeperName ? ` <span class="muted">(${p.keeperName}当家)</span>` : '';
      return `<div class="row">
        <span>${p.name}${keeper}</span>
        <span class="num good">+${(Number(p.incomePerDay) || 0).toFixed(1)} 两/日</span>
      </div>`;
    }).join('');
    if (otherProps.length > 0) {
      accHtml += `<div class="muted" style="margin:8px 0 2px;font-size:12px;">眷属私产（独立核算·不入公账）</div>`;
      accHtml += otherProps.map(p => {
        const ownerName = p.ownerName || p.keeperName || '眷属';
        return `<div class="row">
          <span>${p.name} <span class="muted">(${ownerName}私产)</span></span>
          <span class="num" style="color:#a78bfa;">+${(Number(p.incomePerDay) || 0).toFixed(1)} 两/日</span>
        </div>`;
      }).join('');
    }"""

assert old_acc in text, "old_acc not found in dashboard.html"
text = text.replace(old_acc, new_acc, 1)

with open('web/dashboard.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("dashboard.html accounts decoupling patched successfully!")

