import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 回执标签绝不能出现在回复里"
block = (
    "    // ① 天道场景标签不许漏到正文\n"
    "    try {\n"
    "      if (reply) {\n"
    "        reply = String(reply)\n"
    "          .replace(/【天道[·:：][^】]*】[:：]?/g, '')\n"
    "          .replace(/【天道】[:：]?/g, '')\n"
    "          .replace(/\\n{2,}/g, '\\n')\n"
    "          .trim();\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // ② 府里的人不许装不认识（模型偶尔无视名单）\n"
    "    try {\n"
    "      if (reply) {\n"
    "        const wF = loadState(this.dataDir);\n"
    "        const house = Object.values(wF.actors || {}).filter(\n"
    "          (a) => a && !a.dead && a.id !== 'husband' && (a.household || a.id === 'waner' || a.id === 'yunnia' || a.id === 'xiaocui'),\n"
    "        );\n"
    "        const asked = house.find((a) => a.name && String(say || '').includes(a.name));\n"
    "        const denies = /(哪家的姑娘|不认识|没听说过|不认得|从哪儿听来|这是谁)/;\n"
    "        if (asked && denies.test(String(reply))) {\n"
    "          console.log(`[Scene] ${asked.name}被当成外人，已改正`);\n"
    "          reply = `【府中】：${asked.name}是${asked.role || '府里人'}，就住在这宅子里。`;\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 回执标签绝不能出现在回复里"
)
if anchor in s and '天道场景标签不许漏到正文' not in s:
    s = s.replace(anchor, block, 1)
    print('patched: strip scene tags + fix denial')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
