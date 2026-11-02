import io

# ① 代演提示：只许依据事实清单
p = 'src/world/proxy-actor.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("  const system = [")
end = s.find("    .join('\\n');", start)
if start < 0 or end < 0:
    print('WARN: system block not found')
else:
    new_system = (
        "  const system = [\n"
        "    `你现在代演「${actor?.name || '王甯'}」——${actor?.role || '临江茶坊少东家'}。他本人不在线，由你按他的记忆与立场说话。`,\n"
        "    '铁律：',\n"
        "    '1. 你只依据下面「事实清单」说话。清单里没有的关系、金钱、去处、承诺，你一律不知道——说不记得/不清楚，绝不许推断、绝不许编。',\n"
        "    '2. 你就是他本人。别人问「王掌柜在不在」，问的就是你，不许说「他不在」。',\n"
        "    '3. 只写他自己说的话，一到两句；不要旁白、不要写别人的台词、不要以他的名字开头。',\n"
        "    '4. 不许提别的女人的名字（除非事实清单里有）。',\n"
        "    '5. 不许用「一时恍惚」「认错人」「你与她太像」这类话搪塞。',\n"
        "    memories.length ? `旧事：${memories.slice(-6).join('；')}` : '',\n"
        "    facts.length ? `事实清单：${facts.slice(-10).join('；')}` : '事实清单：（空）——那你什么都不知道，只说不记得。',\n"
        "  ]\n"
    )
    s = s[:start] + new_system + s[end:]
    print('rewrote proxy system prompt')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 越界硬拦：提到别的女人 / 把她的丈夫当心上人
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

old = (
    "              const hasLoan = (wPost.promises || []).some((pr) => pr && pr.loan && !pr.done);\n"
    "              const moneyTalk = /(借|欠|交到你手上|交给你|到期|还你|这二十两|银子我认)/;\n"
    "              if (line && !hasLoan && moneyTalk.test(line)) {\n"
    "                console.log('[Proxy] 账本无借贷，已拦下：' + line.slice(0, 40));\n"
    "                line = `【${husPost?.name || '王甯'}】：这话我听不明白——我账上没有这笔。`;\n"
    "              }"
)
new = (
    "              const hasLoan = (wPost.promises || []).some((pr) => pr && pr.loan && !pr.done);\n"
    "              const moneyTalk = /(借|欠|交到你手上|交给你|到期|还你|这二十两|银子我认)/;\n"
    "              if (line && !hasLoan && moneyTalk.test(line)) {\n"
    "                console.log('[Proxy] 账本无借贷，已拦下：' + line.slice(0, 40));\n"
    "                line = `【${husPost?.name || '王甯'}】：这话我听不明白——我账上没有这笔。`;\n"
    "              }\n"
    "              // 提到别的女人（不在事实里）→ 删掉那句\n"
    "              if (line) {\n"
    "                const others = ['婉儿', '芸娘', '小翠', '苏慕雪', '杨采云', '静儿', '杨采儿', '苏娘'];\n"
    "                const parts = line.split(/(?<=[。！？；])/);\n"
    "                const kept = parts.filter((x) => !others.some((n) => x.includes(n)));\n"
    "                if (kept.length && kept.join('').trim().length > 0) line = kept.join('').trim();\n"
    "                else if (others.some((n) => line.includes(n))) line = null;\n"
    "              }\n"
    "              // 把她的丈夫说成自己的心上人 → 整句替换\n"
    "              if (line && /(心里装着|心里有的是|惦记着)(于杰|于子归|她丈夫)/.test(line)) {\n"
    "                console.log('[Proxy] 关系错位，已拦下：' + line.slice(0, 30));\n"
    "                line = `【${husPost?.name || '王甯'}】：我心里装的是你，不是旁人。`;\n"
    "              }"
)
if old in s2:
    s2 = s2.replace(old, new)
    print('added out-of-scope filters')
else:
    print('WARN: hard block not found')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
