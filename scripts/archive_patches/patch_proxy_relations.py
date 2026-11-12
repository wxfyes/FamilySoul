import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "            // 借贷备忘：以账本为准，别被聊天带偏"
inject = (
    "            // 他与她、她与别人的关系，先讲清楚，别把别人的丈夫当成自己的心上人\n"
    "            try {\n"
    "              const relH = mePost?.relations?.husband || {};\n"
    "              promiseFacts.push(`你和${herName || '她'}是相好（她对你：信任${relH.trust ?? 50}、欲望${relH.desire ?? 0}、怨怼${relH.grievance ?? 0}），她是你的人`);\n"
    "              const spouse = Object.values(wPost.actors || {}).find(\n"
    "                (a) => a && !a.dead && a.id !== this._viewerActorId && a.id !== 'husband' && a.gender === 'male'\n"
    "                  && a.home && mePost?.home && a.home === mePost.home,\n"
    "              );\n"
    "              if (spouse) {\n"
    "                promiseFacts.push(`${spouse.name}是${herName || '她'}的丈夫，与你无关——你心里不可能装着他`);\n"
    "              }\n"
    "            } catch { /* 忽略 */ }\n\n"
    "            // 借贷备忘：以账本为准，别被聊天带偏"
)
if anchor in s and '你心里不可能装着他' not in s:
    s = s.replace(anchor, inject, 1)
    print('added relationship facts')
else:
    print('WARN: anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
