import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("    // 兜底：回复里出现了账本没有的")
end = s.find("    // 回执标签绝不能出现在回复里")
if start < 0 or end < 0:
    print('WARN: fallback block not found')
else:
    new_block = (
        "    // 兜底造人：只认\"叫某某\"这种明确说法，避免把动词当名字\n"
        "    try {\n"
        "      if (reply) {\n"
        "        const pat = /(?:叫|名叫|唤作|唤做)\\s*([\\u4e00-\\u9fa5]{2,3})/g;\n"
        "        const wNow2 = loadState(this.dataDir);\n"
        "        const known = new Set(Object.values(wNow2.actors || {}).map((a) => a && a.name).filter(Boolean));\n"
        "        const fresh = [];\n"
        "        let m2;\n"
        "        while ((m2 = pat.exec(String(reply))) !== null) {\n"
        "          const nm = m2[1];\n"
        "          if (known.has(nm)) continue;\n"
        "          if (/(什么|怎样|如何|谁|哪里|哪儿)/.test(nm)) continue;\n"
        "          if (fresh.some((x) => x.name === nm)) continue;\n"
        "          if (fresh.length >= 2) break;\n"
        "          fresh.push({ name: nm, role: '城中人' });\n"
        "        }\n"
        "        if (fresh.length) {\n"
        "          applyWorldTags(this.dataDir, fresh.map((f) => ({ kind: 'spawn', args: { name: f.name, role: f.role } })), { selfId: this._viewerActorId });\n"
        "          console.log('[World] 天道造人：' + fresh.map((f) => f.name).join('、'));\n"
        "        }\n"
        "      }\n"
        "    } catch { /* 忽略 */ }\n\n"
    )
    s = s[:start] + new_block + s[end:]
    print('replaced spawn fallback with 叫X only')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
