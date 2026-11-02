import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "export function loadState(dataDir) {"
if anchor not in s:
    print('WARN: loadState not found')
else:
    fn = (
        "/** 老存档补归属：地点/势力/线索没写主人的，按预设补上，别让自检一直报无主 */\n"
        "export function migrateOwnership(world) {\n"
        "  if (!world || typeof world !== 'object') return world;\n"
        "  // 地点\n"
        "  for (const [id, p] of Object.entries(world.places || {})) {\n"
        "    if (!p || p.owner) continue;\n"
        "    if (id === 'street' || id === 'dock' || id === 'canal') p.owner = 'public';\n"
        "    else if (id === 'yamen') p.owner = 'court';\n"
        "    else if (id === 'yang_mansion') p.owner = 'yangzhenhua';\n"
        "    else if (id === 'wine_shop') p.owner = 'liuwenxia';\n"
        "    else if (id === 'goods_shop') p.owner = 'yangcaiyun';\n"
        "    else p.owner = 'husband';\n"
        "  }\n"
        "  // 势力\n"
        "  for (const [id, pw] of Object.entries(world.powers || {})) {\n"
        "    if (!pw || pw.ownerActor) continue;\n"
        "    if (id === 'wangjia') pw.ownerActor = 'husband';\n"
        "    else if (id === 'court') pw.ownerActor = 'court';\n"
        "  }\n"
        "  // 线索\n"
        "  for (const c of world.clues || []) {\n"
        "    if (c && !c.owner) c.owner = 'husband';\n"
        "  }\n"
        "  return world;\n"
        "}\n\n"
    )
    s = s.replace(anchor, fn + anchor, 1)
    print('added migrateOwnership')

# 在 loadState 返回前调用
marker = "export function loadState(dataDir) {"
idx = s.find(marker)
end = s.find("\n}", idx)
if end < 0:
    print('WARN: loadState end not found')
else:
    # 在 return 之前插入调用：找到该函数体内最后一个 return
    body_start = idx
    body_end = s.find("\n}", idx)
    body = s[body_start:body_end]
    if 'migrateOwnership(' not in body:
        # 简单做法：在函数体开头包一层
        s = s.replace(
            "export function loadState(dataDir) {",
            "export function loadState(dataDir) {\n  const __w = __loadStateInner(dataDir);\n  return migrateOwnership(__w);\n}\n\nfunction __loadStateInner(dataDir) {",
            1,
        )
        print('wrapped loadState with migration')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
