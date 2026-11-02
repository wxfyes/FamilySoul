import io

p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

idx = None
for i, line in enumerate(lines):
    if 'const applied = realOps.length > 0 ? applyWorldTags(this.dataDir, realOps' in line:
        idx = i
        break
if idx is None:
    print('WARN: apply line not found')
else:
    before = [
        "    // 记下相公原本位置：她走动不该把他一起搬走",
        "    const husBefore = (() => { try { return loadState(this.dataDir).actors?.husband?.location || null; } catch { return null; } })();",
    ]
    after = [
        "    try {",
        "      if (this._viewerActorId && this._viewerActorId !== 'husband' && husBefore) {",
        "        const calledHim = /(王甯|王掌柜|少掌柜|相公)/.test(String(say || ''));",
        "        const w1 = loadState(this.dataDir);",
        "        const hus1 = w1.actors?.husband;",
        "        const me1 = w1.actors?.[this._viewerActorId];",
        "        if (!calledHim && hus1 && me1 && hus1.location !== husBefore && hus1.location === me1.location) {",
        "          hus1.location = husBefore;",
        "          saveState(this.dataDir, w1);",
        "          console.log(`[Scene] 还原：${me1.name}走动不该带走相公（他仍在原处）`);",
        "        }",
        "      }",
        "    } catch { /* 忽略 */ }",
    ]
    lines = lines[:idx] + before + [lines[idx]] + after + lines[idx + 1:]
    print('inserted guard around apply')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('ok')
