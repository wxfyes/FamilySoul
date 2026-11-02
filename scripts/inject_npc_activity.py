import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 把"在场的人正在做什么"接进她的对话上下文
old = "        bits.push(hereNames.length ? `此刻在跟前的只有：${hereNames.join('、')}` : '此刻跟前没有别人');"
new = (
    "        bits.push(hereNames.length ? `此刻在跟前的只有：${hereNames.join('、')}` : '此刻跟前没有别人');\n"
    "        const acts = (wNow.actors ? Object.values(wNow.actors) : [])\n"
    "          .filter((a) => a && !a.dead && a.location === locNow && a.id !== this._viewerActorId && a.activity?.text)\n"
    "          .map((a) => `${a.name}正在${a.activity.text}`)\n"
    "          .slice(0, 4);\n"
    "        if (acts.length) bits.push(`他们手头的事：${acts.join('；')}（他们说自己的话时，要跟他们正在做的事对得上）`);"
)
if old in s and '他们手头的事' not in s:
    s = s.replace(old, new, 1)
    print('patched: inject npc activity into context')
else:
    print('WARN: hereNames line not found or already patched')

# ② 代演也要知道对方在忙什么
old2 = "                promiseFacts.push(`${spouse.name}是${herName || '她'}的丈夫，与你无关——你心里不可能装着他`);"
new2 = (
    "                promiseFacts.push(`${spouse.name}是${herName || '她'}的丈夫，与你无关——你心里不可能装着他`);\n"
    "              }\n"
    "              if (mePost?.activity?.text) {\n"
    "                promiseFacts.push(`她眼下正${mePost.activity.text}`);"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: proxy knows her current activity')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
