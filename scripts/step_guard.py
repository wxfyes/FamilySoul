import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "      try { await generateCase(); } catch (e) { /* 忽略 */ }\n"
    "      try { await judgeCases(); } catch (e) { /* 忽略 */ }\n"
    "      try { await resolveMemorials(); } catch (e) { /* 忽略 */ }\n"
    "      try { await generateDecree(); } catch (e) { /* 忽略 */ }\n"
    "      try { await generateCityShops(); } catch (e) { /* 忽略 */ }\n"
    "      try { await generateNpcArcs(); } catch (e) { /* 忽略 */ }\n"
)
new = (
    "      // 没有模型密钥时，只跑规则部分，不让请求卡死\n"
    "      const aiReady = (() => { try { return petService.llmClient.isReady(); } catch { return false; } })();\n"
    "      if (aiReady) {\n"
    "        try { await generateCase(); } catch (e) { /* 忽略 */ }\n"
    "        try { await judgeCases(); } catch (e) { /* 忽略 */ }\n"
    "        try { await resolveMemorials(); } catch (e) { /* 忽略 */ }\n"
    "        try { await generateDecree(); } catch (e) { /* 忽略 */ }\n"
    "        try { await generateCityShops(); } catch (e) { /* 忽略 */ }\n"
    "        try { await generateNpcArcs(); } catch (e) { /* 忽略 */ }\n"
    "      } else {\n"
    "        done.push('（无模型密钥，仅推进规则）');\n"
    "      }\n"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: step skips LLM when not ready')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
