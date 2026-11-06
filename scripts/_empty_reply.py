import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            const short = prime.name && prime.name.length > 2 ? prime.name.slice(-2) : prime.name;
            reply = `【${prime.label || prime.name || short}】：“相公吩咐，妾身在这儿听着呢。这桩事相公既说了，妾身这就照办。”`;
          } else {
            reply = engineMovedHusband && pNow ? `【${pNow}】：（你到了${pNow}。）` : '……';
          }"""
new = """            // 不给预制台词：让天道照此刻的实况接一句
            let retried = '';
            try {
              if (this.llmClient?.isReady?.()) {
                const out = await this.llmClient.complete({
                  system: '你是这个世界的天道。只写此刻这一处的实况与在场者的一句反应，不写剧本、不安排后事，不超过 60 字。说话人必须写【身份·名字】：。',
                  messages: [{ role: 'user', content: `地点：${pNow}。在场：${hereOthers.map((x) => x.name).join('、')}。相公刚说：${String(say || '').slice(0, 80)}` }],
                  temperature: 0.85,
                  maxTokens: 200,
                });
                retried = String(typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '')).trim();
              }
            } catch { /* 忽略 */ }
            reply = retried && !/^[...…\\s]+$/.test(retried) ? retried : `（${pNow}：此刻只有${prime.name || '你'}在跟前。）`;
          } else {
            // 一个人也没有：让天道照实况写一句旁白，而不是甩一省略号
            let retried = '';
            try {
              if (this.llmClient?.isReady?.()) {
                const out = await this.llmClient.complete({
                  system: '你是这个世界的天道。只写此刻这一处的实况（地方、陈设、动静），不写剧本、不安排后事，不超过 50 字。',
                  messages: [{ role: 'user', content: `地点：${pNow}。相公刚说：${String(say || '').slice(0, 80)}` }],
                  temperature: 0.85,
                  maxTokens: 180,
                });
                retried = String(typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '')).trim();
              }
            } catch { /* 忽略 */ }
            reply = retried && !/^[...…\\s]+$/.test(retried) ? retried : `（${pNow}，一时无人。）`;
          }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('空回复改为天道补一句实况')
