import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

reps = [
 ("reply = `（${names.length} 名护院应声列到跟前：${names.join('、')}。）\\n` + String(reply || '');",
  "reply = `【提示】${names.length} 名护院应声列到跟前：${names.join('、')}\\n` + String(reply || '');"),
 ("reply = String(reply || '') + `\\n（${names.join('、')}起身告辞，退了出去。）`;",
  "reply = String(reply || '') + `\\n【提示】${names.join('、')}起身告辞，退了出去。`;"),
 ("reply += `\\n（${target.name}应声到跟前来了。）`;",
  "reply += `\\n【提示】${target.name}到了跟前。`;"),
 ("reply += `\\n（${target.name}到了厅上候着，未得通报，不敢进内室。）`;",
  "reply += `\\n【提示】${target.name}到了厅上候着，未得通报，不敢进内室。`;"),
 ("reply += `\\n（${names.join('、')}都应声到跟前来了。）`;",
  "reply += `\\n【提示】${names.join('、')}都应声到跟前来了。`;"),
 ("reply += `\\n（已付 ${price.toFixed(2)} 两：${String(title2 || '花销').slice(0, 12)}。余 ${wPay.assets.silver.toFixed(2)} 两。）`;",
  "reply += `\\n【提示】已付 ${price.toFixed(2)} 两：${String(title2 || '花销').slice(0, 12)}。余 ${wPay.assets.silver.toFixed(2)} 两。`;"),
]
n = 0
for a, b in reps:
    if a in s:
        s = s.replace(a, b, 1)
        n += 1
# 货/赌/打点等 r.line：统一套【提示】
s = s.replace("        reply += `\\n${r.line}`;", "        reply += `\\n【提示】${String(r.line || '').replace(/^（/, '').replace(/）$/, '')}`;")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('替换', n, '条 + 货物行')
