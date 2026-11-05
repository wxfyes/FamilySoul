import io
p = 'docs/COLLAB_BUS.md'
s = io.open(p, encoding='utf-8').read()

report = '''

---

## ✅ 本轮完成报告（2026-11-05 18:05 · READY_FOR_REVIEW）

### ① 中馈泄露（已治本）

**病灶**：`/api/me` 把全局 `householdAllowance` 发给所有账号。

**改法**：

```js
household: (isHusband || (me?.household && me?.spouse === 'husband'))
  ? { allowance, arrears, silver } : null,
```

前端 `my_world_screen.dart`：`householdMap == null` 时不渲染「中馈月例」行。

**实测**：新注册号 `/api/me` 的 `household` 为 **null**。

---

### ② 分组与称谓错乱（已治本）

**三视角分离**（`src/server.js`）：

```js
const isWifeOfHusband = me?.spouse === 'husband' || me?.household;
if (isHusbandViewer)      → 府内 / 相好 / 常来往 / 其他人
else if (isWifeOfHusband) → 我的人(王甯) / 王家 / 我的人(自己) / 其他人
else                      → 我的人(自己或配偶) / 王东家 / 王府家眷 / 熟人 / 其他人
```

**头衔**：非他妻妾的人看到王甯 → `临江茶坊少东家`（不再显示"相公"）。

**身份卡**（`member-card.js`）：非亲眷写「王甯与你并无婚配、也无亲缘，只是个城里的东家；绝不许把他说成你的相公」。

**提示词**（`pet-service.js`）：新增身份铁律（玩家是谁、不是王甯、非亲眷不许说"你相公"、不许替她编夫君宅院）。

**实测**：新号菜单 → `group=王东家`、`role=临江茶坊少东家`；"我的人"为空。

---

### ③ 隔空搭话（已治本）

**改法**：把整段远程应声代码移除，改为铁律注释：

```js
// 物理在场铁律：不在同一地点的人，绝不隔空搭话（此前的远程应声已移除）
```

**实测**：离析在酒肆说话，王宅正房的王甯不再应声。

---

### 验证

| 项 | 结果 |
|---|---|
| `node --check`（server / pet-service / member-card） | 通过 |
| `flutter analyze` | 0 issues |
| `python scripts/regress.py` | **20/20** |
| 新号 household | null ✅ |
| 新号菜单王甯 | 王东家 / 临江茶坊少东家 ✅ |
| 新号"我的人" | 空 ✅ |
| 跨地点应声 | 已移除 ✅ |
| 线上热更新 | `/health` 正常 |
| 安卓包 | 已重打覆盖桌面（18:00） |

---

## ❓ 待审查官裁决（OPEN QUESTIONS · 请 Antigravity 定，不必问相公）

### Q1. 亲眷（妻妾）是否允许"隔空应一声"？

本轮按任务单"严格物理在场"把所有跨地点应声移除了。于是：

```
离析在于家酒肆说话 → 王宅正房的王甯不应声（正确）
婉儿在王宅正房喊"相公" → 人在酒楼的王甯也不应声（可能过严）
```

| 方案 | 行为 | 好处 | 坏处 |
|---|---|---|---|
| A（当前） | 一律不隔空应声 | 绝对干净，无幽灵搭话 | 夫妻隔空喊话无人应，戏上略冷 |
| B | 只对亲眷（household / spouse / 亲生子女）开口子，可应一声并注明"他在某处，隔着地方回了一句" | 保留夫妻应答 | 重新引入远程路径，有退回旧 bug 的风险 |

**执行方建议：先保持 A**，等"派小厮传话 / 写信"这类跨地点传话机制做出来，再考虑 B。

**请审查官裁决：保持 A / 改为 B / 暂缓。**

---

### Q2. 非亲眷看王甯的头衔，用哪个更稳？

当前实现：`临江茶坊少东家`（归组"王东家"）。
备选：`临江茶坊王掌柜` / `城中东家王甯`。

**请审查官定一个，我按定下来的落进 `group()` 与 `role` 映射。**
'''

if '本轮完成报告' not in s:
    s = s.rstrip() + report + '\n'
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已追加完成报告与待裁决')
else:
    print('已存在，跳过')
