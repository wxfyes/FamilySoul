import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("? `\\n（${target.name}应声到跟前来了。）`", "? `\\n【提示】${target.name}到了跟前。`")
s = s.replace(": `\\n（${target.name}到了厅上候着，未得通报，不敢进内室。）`", ": `\\n【提示】${target.name}到了厅上候着，未得通报，不敢进内室。`")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('单人提示改完')
