import io

# ① 代演提示接受"事实清单"
p = 'src/world/proxy-actor.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace(
    "export function buildProxyPrompt({ actor, memories = [], hearerName, hearerPlace, said, recent = '' }) {",
    "export function buildProxyPrompt({ actor, memories = [], facts = [], hearerName, hearerPlace, said, recent = '' }) {",
)
s = s.replace(
    "    memories.length ? `他记得的事：${memories.slice(-6).join('；')}` : '',",
    "    memories.length ? `他记得的事：${memories.slice(-6).join('；')}` : '',\n"
    "    facts.length ? `与他有关的硬事实（必须照这个答，不许否认）：${facts.slice(-8).join('；')}` : '',",
)
io.open(p, 'w', encoding='utf-8').write(s)
print('patched proxy prompt: facts')

# ② 调用时把约定 / 事件 / 共同记忆都算作事实
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

old = (
    "            const hisMem = (wPost.memories || []).map((m) => String(m?.text || '')).filter((t) => t.includes('王甯') || t.includes(husPost?.name || ''));"
)
new = (
    "            const herName = mePost?.name || '';\n"
    "            const hisMem = (wPost.memories || []).map((m) => String(m?.text || ''))\n"
    "              .filter((t) => t.includes('王甯') || t.includes(husPost?.name || '') || (herName && t.includes(herName)));\n"
    "            const facts = [];\n"
    "            for (const ap of wPost.appointments || []) {\n"
    "              const who = String(ap?.name || ap?.actorId || '');\n"
    "              if (!who || who === herName || who === 'liuwenxia' || /王甯/.test(who)) {\n"
    "                if (ap?.text || ap?.desc) facts.push(`第${ap.day}日${ap.hour ?? ''}时 ${ap.text || ap.desc}`);\n"
    "              }\n"
    "            }\n"
    "            try {\n"
    "              const evFile = path.join(this.dataDir, 'world', 'events.jsonl');\n"
    "              if (fs.existsSync(evFile)) {\n"
    "                const lines = fs.readFileSync(evFile, 'utf8').trim().split('\\n').slice(-80);\n"
    "                for (const line of lines) {\n"
    "                  try {\n"
    "                    const e = JSON.parse(line);\n"
    "                    const t = String(e?.payload?.text || '');\n"
    "                    if (!t) continue;\n"
    "                    if (t.includes('雅阁') || (herName && t.includes(herName)) || t.includes('王甯')) facts.push(t);\n"
    "                  } catch { /* 忽略 */ }\n"
    "                }\n"
    "              }\n"
    "            } catch { /* 忽略 */ }\n"
)
if old in s2:
    s2 = s2.replace(old, new)
    print('patched: gather facts')
else:
    print('WARN: hisMem line not found')

s2 = s2.replace(
    "              memories: hisMem,",
    "              memories: hisMem,\n              facts,",
)
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
