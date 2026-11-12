import io

# ① 代演提示：加"刚才的对话"为主信息，禁止用恍惚/认错人搪塞
p = 'src/world/proxy-actor.js'
s = io.open(p, encoding='utf-8-sig').read()

s = s.replace(
    "    '4. 他不知道的事不许假装知道；不确定就照实说不知道。',",
    "    '4. 他不知道的事不许假装知道；不确定就照实说不知道，但不许用「一时恍惚」「认错人」「你与她太像」这类话搪塞；',\n"
    "    '5. 你和她的来往你都记得（见下方事实）；只有事实里没有的，才说不记得。',",
)
s = s.replace("  return { system, user, maxTokens: 160 };", "  return { system, user, maxTokens: 220 };")

# user 侧把 recent 放到最前，权重更高
s = s.replace(
    "  const user = [\n    `此刻在「${hearerPlace || '某处'}」。`,\n    recent ? `刚才的话：${recent}` : '',",
    "  const user = [\n    recent ? `刚才你们说的：\\n${recent}` : '',\n    `此刻在「${hearerPlace || '某处'}」。`,",
)
io.open(p, 'w', encoding='utf-8').write(s)
print('patched proxy prompt')

# ② 调用：传 recent，并放宽记忆范围
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

old = (
    "            const hisMem = (wPost.memories || []).map((m) => String(m?.text || ''))\n"
    "              .filter((t) => t.includes('王甯') || t.includes(husPost?.name || '') || (herName && t.includes(herName)));"
)
new = (
    "            const hisMem = (wPost.memories || []).map((m) => String(m?.text || ''))\n"
    "              .filter((t) => t.includes('王甯') || t.includes(husPost?.name || '') || (herName && t.includes(herName))\n"
    "                || /(相公|雅阁|相好|留门|答应了)/.test(t))\n"
    "              .slice(-12);\n"
    "            const recentLines = [...(this.readHistory(profileKey).messages || [])]\n"
    "              .slice(-4)\n"
    "              .map((m) => `${m.role === 'user' ? (herName || '她') : ''}${String(m.text || '').slice(0, 60)}`)\n"
    "              .filter(Boolean)\n"
    "              .join('\\n');"
)
if old in s2:
    s2 = s2.replace(old, new)
    print('patched: recent + wider memories')
else:
    print('WARN: hisMem block not found')

s2 = s2.replace("              said: String(say || '').slice(0, 200),", "              said: String(say || '').slice(0, 200),\n              recent: recentLines,")
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
