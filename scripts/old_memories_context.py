import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 她的上下文里补"旧事"（永久记忆）
old = "        const rumorLines = rumorsKnownBy(wHere, hereIds);"
new = (
    "        // 旧事：写进账本的永久记忆（亲密、承诺、翻脸）——别让它们随时间消失\n"
    "        try {\n"
    "          const myId2 = this._viewerActorId;\n"
    "          const olds = (wHere.memories || [])\n"
    "            .filter((m) => {\n"
    "              if (!m || !m.text) return false;\n"
    "              const about = Array.isArray(m.about) ? m.about : [];\n"
    "              if (m.visible === 'public') return true;\n"
    "              if (about.includes(myId2) || about.includes('husband')) return true;\n"
    "              return /(紫嫣|文霞)/.test(String(m.text)) && String(m.text).includes(String(meA?.name || '紫嫣'));\n"
    "            })\n"
    "            .slice(-8)\n"
    "            .map((m) => String(m.text));\n"
    "          if (olds.length) bits.push(`你记得的旧事：${olds.join('；')}（提起来要照这些说，别说不记得）`);\n"
    "        } catch { /* 忽略 */ }\n"
    "        const rumorLines = rumorsKnownBy(wHere, hereIds);"
)
if old in s and '你记得的旧事' not in s:
    s = s.replace(old, new, 1)
    print('patched: old memories into member context')

# ② 记账员记旧事时带 about
old2 = "  [[world:remember text=\"那夜大被同眠，婉儿第一次唤相公为夫君\"]]"
new2 = "  [[world:remember text=\"那夜大被同眠，婉儿第一次唤相公为夫君\" about=waner]]"
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: remember example carries about')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
