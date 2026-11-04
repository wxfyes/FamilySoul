import io

p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

# ① 记录开局位置（在 selfId 定义之后）
for i, l in enumerate(lines):
    if 'const selfId = actorId || profileKey;' in l:
        lines.insert(i + 1, "    // 记录开局位置：这一轮如果换了地方，末尾补一行\"你到了\"\n    const __locAtStart = (() => { try { const w0 = loadState(this.dataDir); return (this._viewerActorId ? w0.actors?.[this._viewerActorId] : w0.actors?.husband)?.location || null; } catch { return null; } })();")
        print('① 记录开局位置 at line', i + 1)
        break

# ② 在保存历史前补"你到了"那一行
for i, l in enumerate(lines):
    if 'this.saveHistory(profileKey, history);' in l and i > 500:
        block = [
            "    // 换地方了：在回复末尾补一行\"你到了\"，带上此处有谁（引擎写事实，不写台词）",
            "    try {",
            "      const wEnd2 = loadState(this.dataDir);",
            "      const __meEnd = this._viewerActorId ? wEnd2.actors?.[this._viewerActorId] : wEnd2.actors?.husband;",
            "      const __locNow = __meEnd?.location || null;",
            "      if (__locAtStart && __locNow && __locNow !== __locAtStart) {",
            "        const __placeName = String(wEnd2.places?.[__locNow]?.name || __locNow);",
            "        const __here = Object.values(wEnd2.actors || {})",
            "          .filter((a) => a && !a.dead && a.name && a.location === __locNow && a.id !== (__meEnd?.id || 'husband'))",
            "          .slice(0, 5)",
            "          .map((a) => a.name + (a.activity?.text ? '在' + a.activity.text : ''));",
            "        const __line = `（你到了「${__placeName}」。${__here.length ? '此处：' + __here.join('，') + '。' : '此处无人。'}）`;",
            "        if (!String(reply || '').includes(__placeName)) reply = `${String(reply || '').trim()}\\n${__line}`.trim();",
            "        else if (!String(reply || '').includes('此处')) reply = `${String(reply || '').trim()}\\n${__line}`.trim();",
            "        console.log(`[Scene] 到了${__placeName}（此处 ${__here.length} 人）`);",
            "      }",
            "    } catch { /* 忽略 */ }",
            "",
        ]
        lines = lines[:i] + block + lines[i:]
        print('② 到了提示 at line', i + 1)
        break

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('done')
