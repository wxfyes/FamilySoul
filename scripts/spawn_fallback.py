import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 回执标签绝不能出现在回复里"
block = (
    "    // 兜底：回复里出现了账本没有的\"某婆子/某货郎\"，天道就让他存在\n"
    "    try {\n"
    "      if (reply) {\n"
    "        const pat = /([\\u4e00-\\u9fa5]{2,4})(婆子|娘子|老汉|汉子|货郎|船夫|郎中|秀才|掌柜|妇人|脚夫|绣娘|花子|屠户|车夫)/g;\n"
    "        const wNow2 = loadState(this.dataDir);\n"
    "        const known = new Set(Object.values(wNow2.actors || {}).map((a) => a && a.name).filter(Boolean));\n"
    "        const fresh = [];\n"
    "        let m2;\n"
    "        while ((m2 = pat.exec(String(reply))) !== null) {\n"
    "          const nm = m2[1];\n"
    "          if (known.has(nm) || /(自己|我们|他们|你们|咱们|人家)/.test(nm)) continue;\n"
    "          if (fresh.some((x) => x.name === nm)) continue;\n"
    "          if (fresh.length >= 2) break;\n"
    "          fresh.push({ name: nm, role: m2[2] });\n"
    "        }\n"
    "        if (fresh.length) {\n"
    "          applyWorldTags(this.dataDir, fresh.map((f) => ({ kind: 'spawn', args: { name: f.name, role: f.role } })), { selfId: this._viewerActorId });\n"
    "          console.log('[World] 天道造人：' + fresh.map((f) => f.name + '(' + f.role + ')').join('、'));\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 回执标签绝不能出现在回复里"
)
if anchor in s and '天道造人：' not in s:
    s = s.replace(anchor, block, 1)
    print('added deterministic spawn fallback')
else:
    print('WARN: anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
