import io
p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()
old = """    $('m-military-top').textContent = `王家私兵 ${totalWangTroops} 人 · 士气 ${morale}`;"""
new = """    const actorsList = Array.isArray(w.actors) ? w.actors : [];
    const houseGuardN = actorsList.filter((a) => a && a.role === '家丁').length;
    const retainerN = actorsList.filter((a) => a && a.role === '护院').length;
    $('m-military-top').textContent = `私兵 ${totalWangTroops} 人 · 士气 ${morale}（家丁 ${houseGuardN} · 护院 ${retainerN}）`;"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 顶部三行')
old2 = """    milHtml += `<div class="row"><span>随军粮草储备</span><span class="num good">${grain.toFixed(1)} 石</span></div>""""
new2 = """    milHtml += `<div class="row"><span>家丁</span><span class="num">${houseGuardN} 人</span></div>`;
    milHtml += `<div class="row"><span>护院</span><span class="num">${retainerN} 人</span></div>`;
    milHtml += `<div class="row"><span>私兵（账上兵额）</span><span class="num">${totalWangTroops} 人</span></div>`;
    milHtml += `<div class="row"><span>随军粮草储备</span><span class="num good">${grain.toFixed(1)} 石</span></div>"""""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 明细三行')
io.open(p, 'w', encoding='utf-8').write(s)
