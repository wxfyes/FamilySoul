import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 纠错只在"真的不认识"时触发，且不许针对说话人自己
old = (
    "        const contradicted = /(么？|么\\?|听说|提过一嘴|哪家|外头|不认识|不认得|从哪儿听来)/.test(String(reply || ''));"
)
new = (
    "        const mSpk = String(reply || '').match(/^【([^】\\n]{1,12})】/);\n"
    "        const speakerName = mSpk ? mSpk[1] : '';\n"
    "        const speakerIsThem = speakerName.includes(houseActor.name) || (houseActor.name.length > 2 && speakerName.includes(houseActor.name.slice(-2)));\n"
    "        const deniesHer = /(哪家|不认识|不认得|没听说过|没听过|从哪儿听来|这是谁|是谁)/.test(String(reply || ''));\n"
    "        const mentionsHer = String(reply || '').includes(houseActor.name) || (houseActor.name.length > 2 && String(reply || '').includes(houseActor.name.slice(-2)));\n"
    "        const contradicted = deniesHer && !mentionsHer && !speakerIsThem;"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: correction only on real denial')

# ② 地点名兜底：不许把 clinic 这种内部 id 念出来
old2 = "        const whereH = String(wHouse.places?.[houseActor.location]?.name || '宅中');"
new2 = (
    "        let whereH = String(wHouse.places?.[houseActor.location]?.name || '');\n"
    "        if (!whereH || /^[a-z0-9_]+$/i.test(whereH)) whereH = String(wHouse.places?.[houseActor.home]?.name || '宅中');\n"
    "        if (!whereH || /^[a-z0-9_]+$/i.test(whereH)) whereH = '宅中';"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: place name fallback')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
