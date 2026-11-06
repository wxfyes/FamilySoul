import io
p = 'web/dashboard.html'
lines = io.open(p, encoding='utf-8').read().split('\n')
out = []
inserted = False
for ln in lines:
    if "$('m-military-top').textContent" in ln and '王家私兵' in ln and not inserted:
        out.append("    const actorsList = Array.isArray(w.actors) ? w.actors : [];")
        out.append("    const houseGuardN = actorsList.filter((a) => a && a.role === '家丁').length;")
        out.append("    const retainerN = actorsList.filter((a) => a && a.role === '护院').length;")
        out.append("    $('m-military-top').textContent = `私兵 ${totalWangTroops} 人 · 士气 ${morale}（家丁 ${houseGuardN} · 护院 ${retainerN}）`;")
        inserted = True
        continue
    if '随军粮草储备' in ln and 'milHtml +=' in ln:
        out.append("    milHtml += `<div class=\"row\"><span>家丁</span><span class=\"num\">${houseGuardN} 人</span></div>`;")
        out.append("    milHtml += `<div class=\"row\"><span>护院</span><span class=\"num\">${retainerN} 人</span></div>`;")
        out.append("    milHtml += `<div class=\"row\"><span>私兵（账上兵额）</span><span class=\"num\">${totalWangTroops} 人</span></div>`;")
    out.append(ln)
io.open(p, 'w', encoding='utf-8').write('\n'.join(out))
print('inserted', inserted)
