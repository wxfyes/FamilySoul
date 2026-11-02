import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("    // 兜底造人：只认\"叫某某\"这种明确说法")
end = s.find("    // 回执标签绝不能出现在回复里")
if start < 0 or end < 0:
    print('WARN: block not found')
else:
    new_block = (
        "    // 兜底造人：①明确『叫某某』 ②故事里需要某个行当的人（郎中/稳婆/仵作…）\n"
        "    try {\n"
        "      if (reply) {\n"
        "        const wNow2 = loadState(this.dataDir);\n"
        "        const actors2 = Object.values(wNow2.actors || {}).filter(Boolean);\n"
        "        const known = new Set(actors2.map((a) => a.name).filter(Boolean));\n"
        "        const fresh = [];\n"
        "        // ① 叫某某\n"
        "        const patName = /(?:叫|名叫|唤作|唤做)\\s*([\\u4e00-\\u9fa5]{2,3})/g;\n"
        "        let m2;\n"
        "        while ((m2 = patName.exec(String(reply))) !== null) {\n"
        "          const nm = m2[1];\n"
        "          if (known.has(nm) || /(什么|怎样|如何|谁|哪里|哪儿)/.test(nm)) continue;\n"
        "          if (fresh.some((x) => x.name === nm)) continue;\n"
        "          fresh.push({ name: nm, role: '城中人' });\n"
        "        }\n"
        "        // ② 行当的人：故事要用到，世上却没有 → 就地长一个\n"
        "        const trades = ['郎中', '大夫', '稳婆', '接生婆', '媒婆', '仵作', '算命先生', '道士', '尼姑', '衙役', '更夫'];\n"
        "        for (const t of trades) {\n"
        "          if (!String(reply).includes(t)) continue;\n"
        "          if (actors2.some((a) => a.name === t || a.role === t)) continue;\n"
        "          if (fresh.some((x) => x.role === t)) continue;\n"
        "          fresh.push({ name: t, role: t });\n"
        "        }\n"
        "        if (fresh.length) {\n"
        "          applyWorldTags(this.dataDir, fresh.slice(0, 3).map((f) => ({ kind: 'spawn', args: { name: f.name, role: f.role } })), { selfId: this._viewerActorId });\n"
        "          console.log('[World] 天道造人：' + fresh.slice(0, 3).map((f) => `${f.name}(${f.role})`).join('、'));\n"
        "        }\n"
        "      }\n"
        "    } catch { /* 忽略 */ }\n\n"
    )
    s = s[:start] + new_block + s[end:]
    print('patched: fallback spawns trades too')

# 提示词：让人物带姓，好找好叫
old2 = "      lines.push('- 你提到账本之外的人（街坊、伙计、婆子、货郎…）时，必须在这句后面附一条：');"
new2 = (
    "      lines.push('- 故事里要用到某个行当的人（郎中、稳婆、仵作、媒婆…）而世上没有时，给他一个姓再写，如「陈郎中」「王稳婆」。');\n"
    "      lines.push('- 你提到账本之外的人（街坊、伙计、婆子、货郎…）时，必须在这句后面附一条：');"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: name new trades with surname')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
