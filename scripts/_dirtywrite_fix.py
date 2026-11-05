import io, re

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 加一个"只合并改动字段"的保存函数（放在 processMigrants 之前）
if 'function saveDelta' not in s:
    anchor = '  // 来客：由天道定名与来历'
    helper = '''  /**
   * 只把"这次真正改过的字段"写回最新世界。
   * 用于"读盘 → await 大模型 → 存盘"的路径：等 LLM 的几秒里玩家可能改了别的东西，
   * 整份 saveState 会把那些操作回滚；按字段合并只覆盖本流程动过的部分。
   */
  function saveDelta(before, after) {
    try {
      const fresh = loadState(DATA_DIR);
      for (const key of Object.keys(after || {})) {
        const b = JSON.stringify(before?.[key]);
        const a = JSON.stringify(after[key]);
        if (a !== b) fresh[key] = after[key];
      }
      saveState(DATA_DIR, fresh);
    } catch (e) {
      console.warn('[Save] 合并写盘失败，回退整份保存：', e.message);
      saveState(DATA_DIR, after);
    }
  }

''' + anchor
    s = s.replace(anchor, helper, 1)
    print('① 加 saveDelta 合并写盘')

# ② 逐个函数：peek 之后记快照，saveState 改成 saveDelta
names = ['fillProactiveTexts', 'resolveMemorials', 'generateCase', 'judgeCases',
         'generateCityShops', 'generateDecree', 'generateNpcArcs', 'dailyAuditWorld', 'selfHealWorld']

def patch_region(src, name):
    i = src.find(f'async function {name}')
    if i < 0:
        return src, False
    # 找函数体结束（下一个顶层 async function 或文件尾）
    j = src.find('\n  async function ', i + 10)
    if j < 0:
        j = len(src)
    body = src[i:j]
    changed = False
    if '__before' not in body:
        m = re.search(r'(\n\s*const world = peek\(DATA_DIR\);)', body)
        if m:
            body = body.replace(m.group(1), m.group(1) + '\n      const __before = JSON.parse(JSON.stringify(world));', 1)
            changed = True
    if 'saveState(DATA_DIR, world);' in body:
        body = body.replace('saveState(DATA_DIR, world);', 'saveDelta(__before, world);')
        changed = True
    return src[:i] + body + src[j:], changed

for n in names:
    s, ok = patch_region(s, n)
    print(('  ✓ ' if ok else '  - ') + n)

io.open(p, 'w', encoding='utf-8-sig').write(s)
