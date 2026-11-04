import io

# ① 删掉 pet-service 里"还原相公位置"的补丁——位置已由 moveActor 统一把关
p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
start = None
for i, l in enumerate(lines):
    if '还原：' in l or ("hus1.location = husBefore" in l):
        start = i
        break
if start is None:
    print('WARN: 没找到还原块')
else:
    # 向上找到 try { 那行，向下找到 catch 那行
    s0 = start
    while s0 > 0 and 'try {' not in lines[s0]:
        s0 -= 1
    e0 = start
    while e0 < len(lines) and '/* 忽略 */ }' not in lines[e0]:
        e0 += 1
    removed = e0 - s0 + 1
    lines = lines[:s0] + ['    // （位置由 moveActor 统一把关，不再需要事后还原）'] + lines[e0 + 1:]
    io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
    print(f'① 删掉事后还原补丁（{removed} 行）')

# ② 启动时登记"哪些角色是真人登着的"
p2 = 'src/server.js'
s = io.open(p2, encoding='utf-8-sig').read()
old = "try { seedPersonalMoney(wA); } catch { /* 忽略 */ }"
new = """try { seedPersonalMoney(wA); } catch { /* 忽略 */ }

// 登记真人登着的角色：世界里不许引擎搬他们
try {
  const cfgH = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const humans = Object.values(cfgH.family || {}).map((m) => m?.actor).filter(Boolean);
  wA.flags = wA.flags || {};
  wA.flags.humanActors = humans;
  for (const id of humans) if (wA.actors?.[id]) wA.actors[id].humanBound = true;
  saveState(DATA_DIR, wA);
  console.log(`[World] 真人角色 ${humans.length} 位：${humans.join('、')}`);
} catch { /* 忽略 */ }"""
if old in s and 'humanActors' not in s:
    s = s.replace(old, new, 1)
    print('② 启动登记真人角色')
io.open(p2, 'w', encoding='utf-8').write(s)
print('done')
