import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'proxy-actor' not in s:
    s = s.replace(
        "import { recordHumanLine, memberKeyOfActor } from './world/co-presence.js';",
        "import { recordHumanLine, memberKeyOfActor } from './world/co-presence.js';\n"
        "import { buildProxyPrompt, wrapProxyLine } from './world/proxy-actor.js';",
    )
    print('imported proxy-actor')

# 在 normalize 之后：若点了王甯、他在场、却没写他的台词 → 单独代演一句
anchor = "        reply = normalizeMemberReply(reply, {"
if anchor not in s:
    print('WARN: normalize call not found')
else:
    # 找到该调用的结束 ), 之后插入
    idx = s.find(anchor)
    end = s.find('});', idx)
    end = s.find('\n', end) + 1
    block = (
        "\n"
        "        // 点了王甯、他也在场，却没写他的台词 → 单独代演一句（小调用）\n"
        "        if (husHere && /(王甯|王掌柜|少掌柜|相公)/.test(String(say || '')) && !/【[^】]*王甯/.test(String(reply))) {\n"
        "          try {\n"
        "            const hisMem = (wPost.memories || []).map((m) => String(m?.text || '')).filter((t) => t.includes('王甯') || t.includes(husPost?.name || ''));\n"
        "            const pp = buildProxyPrompt({\n"
        "              actor: husPost,\n"
        "              memories: hisMem,\n"
        "              hearerName: mePost?.name || '',\n"
        "              hearerPlace: String(wPost.places?.[locPost]?.name || ''),\n"
        "              said: String(say || '').slice(0, 200),\n"
        "            });\n"
        "            const r = await this.llmClient.complete({\n"
        "              system: pp.system,\n"
        "              messages: [{ role: 'user', content: pp.user }],\n"
        "              maxTokens: pp.maxTokens,\n"
        "              temperature: 0.8,\n"
        "            });\n"
        "            const line = wrapProxyLine(husPost?.name || '王甯', r?.text);\n"
        "            if (line) {\n"
        "              reply = `${line}\\n${reply}`;\n"
        "              console.log('[Proxy] 代演王甯：' + line.slice(0, 40));\n"
        "            }\n"
        "          } catch (err) {\n"
        "            console.warn('[Proxy] 代演失败：', err.message);\n"
        "          }\n"
        "        }\n"
    )
    s = s[:end] + block + s[end:]
    print('added proxy call for husband')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
