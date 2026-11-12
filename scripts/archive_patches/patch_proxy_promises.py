import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 承诺也算硬事实
anchor = "            try {\n              const evFile = path.join(this.dataDir, 'world', 'events.jsonl');"
add = (
    "            for (const pr of wPost.promises || []) {\n"
    "              const t = String(pr?.text || '');\n"
    "              if (!t) continue;\n"
    "              if ((herName && t.includes(herName)) || t.includes('紫嫣') || t.includes('文霞')) {\n"
    "                facts.push(`他曾许下：${t}`);\n"
    "              }\n"
    "            }\n"
)
if anchor in s and '他曾许下' not in s:
    s = s.replace(anchor, add + anchor, 1)
    print('added promises to facts')

# ② 老记忆没有 about：提她/提相公的，照样给他用
old = (
    "                const about = Array.isArray(m?.about) ? m.about : [];\n"
    "                if (m?.visible === 'public') return true;\n"
    "                if (about.length === 0) return false; // 没写主人的，默认不给外人看\n"
    "                return about.includes(myId) || about.includes('husband') || about.includes('紫嫣');"
)
new = (
    "                const text = String(m?.text || '');\n"
    "                const about = Array.isArray(m?.about) ? m.about : [];\n"
    "                if (m?.visible === 'public') return true;\n"
    "                if (about.includes(myId) || about.includes('husband') || about.includes('紫嫣') || about.includes('刘文霞')) return true;\n"
    "                // 老记忆没有主人：提到她、或提到相公的，都算他们之间的事\n"
    "                if (about.length === 0) {\n"
    "                  return /(紫嫣|文霞|相公|雅阁|相好)/.test(text);\n"
    "                }\n"
    "                return false;"
)
if old in s:
    s = s.replace(old, new)
    print('patched: legacy memories included when about her')
else:
    print('WARN: memory filter block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
