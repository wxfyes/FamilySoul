import io

p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

# 在丈夫代演 try 的 catch 结束后、外层 catch 之前，插入"任何被点名在场者"的代演
idx = None
for i, line in enumerate(lines):
    if "'[Proxy] 代演失败：'" in line:
        # 往上找到该 try 的 catch 结束 '}'
        j = i + 1
        while j < len(lines) and lines[j].strip() != '}':
            j += 1
        idx = j  # 指向 catch 的结束 }
        break

if idx is None:
    print('WARN: proxy catch not found')
else:
    block = [
        "",
        "        // 任何被点名的在场者，若主模型不肯写他，就单独代演一句",
        "        try {",
        "          const namedPresent = Object.values(wPost.actors || {}).filter(",
        "            (a) => a && !a.dead && a.id !== this._viewerActorId && a.id !== 'husband'",
        "              && a.location === locPost && a.name && String(say || '').includes(a.name),",
        "          );",
        "          for (const npc of namedPresent.slice(0, 2)) {",
        "            const already = new RegExp(`【[^】]*${String(npc.name).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`).test(String(reply));",
        "            if (already) continue;",
        "            const npcMem = (wPost.memories || [])",
        "              .filter((m) => String(m?.text || '').includes(npc.name))",
        "              .map((m) => String(m.text))",
        "              .slice(-6);",
        "            const npcFacts = (wPost.promises || [])",
        "              .filter((pr) => !pr.done && String(pr.text || '').includes(npc.name))",
        "              .map((pr) => `他曾应下：${pr.text}`)",
        "              .slice(-4);",
        "            const npPrompt = buildProxyPrompt({",
        "              actor: npc,",
        "              memories: npcMem,",
        "              facts: npcFacts.concat([`你和${mePost?.name || '她'}的关系：${npc.role || '相识'}`]),",
        "              hearerName: mePost?.name || '',",
        "              hearerPlace: String(wPost.places?.[locPost]?.name || ''),",
        "              said: String(say || '').slice(0, 200),",
        "              recent: '',",
        "            });",
        "            const npRes = await this.llmClient.complete({",
        "              system: npPrompt.system,",
        "              messages: [{ role: 'user', content: npPrompt.user }],",
        "              maxTokens: 160,",
        "              temperature: 0.8,",
        "            });",
        "            const npLine = wrapProxyLine(npc.name, npRes?.text);",
        "            if (npLine) {",
        "              reply = `${npLine}\\n${String(reply).split('\\n').filter((x) => !/没人应声/.test(x)).join('\\n')}`.trim();",
        "              console.log('[Proxy] 代演' + npc.name + '：' + npLine.slice(0, 40));",
        "            }",
        "          }",
        "        } catch (err) {",
        "          console.warn('[Proxy] 点名代演失败：', err.message);",
        "        }",
    ]
    lines = lines[:idx + 1] + block + lines[idx + 1:]
    print('added generic named-NPC proxy')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('ok')
