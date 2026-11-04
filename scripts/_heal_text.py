import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# 统一把 LLM 返回转成字符串（complete 返回的是对象）
old1 = """        const text = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.4, maxTokens: 1500 });
        const r = applyPlacements(world, text);"""
new1 = """        const out = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.4, maxTokens: 1500 });
        const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || JSON.stringify(out || {}));
        const r = applyPlacements(world, text);"""
if old1 in s:
    s = s.replace(old1, new1, 1)
    print('① 诊断接口转字符串')

old2 = """      const text = await llmClient.complete({
        system,
        messages: [{ role: 'user', content: user }],
        temperature: 0.4,
        maxTokens: 1500,
      });
      const r = applyPlacements(world, text);"""
new2 = """      const out = await llmClient.complete({
        system,
        messages: [{ role: 'user', content: user }],
        temperature: 0.4,
        maxTokens: 1500,
      });
      const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || JSON.stringify(out || {}));
      const r = applyPlacements(world, text);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 心跳转字符串')

io.open(p, 'w', encoding='utf-8').write(s)
