import io, re
p = 'docs/COLLAB_BUS.md'
s = io.open(p, encoding='utf-8').read()

# ① 顶部状态改成 READY_FOR_REVIEW
old_json = re.search(r'```json\n\{[\s\S]*?\}\n```', s)
new_json = '''```json
{
  "status": "READY_FOR_REVIEW",
  "last_updated": "2026-11-05 18:05",
  "active_task": "新人物视角隔离：离析误认相公 / 中馈泄露 / 隔空对话 —— 已按任务单三处治本",
  "priority": "HIGH_BUG_FIX",
  "changed_files": [
    "src/server.js",
    "src/pet-service.js",
    "src/world/member-card.js",
    "mobile/lib/views/my_world_screen.dart"
  ],
  "server_status": "PROD_DEPLOYED_200_OK",
  "android_apk": "Desktop_Updated_18:00",
  "regression_tests": "20/20 PASSED",
  "flutter_analyze": "0 issues",
  "reviewer_verdict_previous": "招募弹窗安家银修正已验收合格通过（17:47 APK已就绪）",
  "reviewer_action": "请审查信箱"
}
```'''
if old_json:
    s = s[:old_json.start()] + new_json + s[old_json.end():]
    print('① 状态切 READY_FOR_REVIEW')

# ② 在"历史交付记录"之前插入本轮完成报告
report = '''
---

## 📋 本轮完成报告（2026-11-05 18:05 · READY_FOR_REVIEW）

### 任务：新人物视角隔离（三项）

### ① 中馈泄露 —— 已治本

**病灶**：`/api/me` 把全局王家 `householdAllowance` 发给所有账号，离析一介光棍也看到"中馈月例 4.0 两/月"。

**改法（服务端 `src/server.js`）**：

```js
household: (isHusband || (me?.household && me?.spouse === 'husband'))
  ? { allowance, arrears, silver }
  : null,
```

**改法（客户端 `my_world_screen.dart`）**：

```dart
final householdMap = (d['household'] as Map?)?.cast<String, dynamic>();
...
if (householdMap != null && hhAllowance > 0) _kv('中馈月例', ...),
```

**实测**：新注册号 `/api/me` 的 `household` 为 **null**，界面不再出现中馈行。

---

### ② 分组与称谓错乱 —— 已治本

**病灶**：非相公账号一律把王甯归进"我的人"，头衔还显示"相公"。

**改法（`src/server.js`，三视角分离）**：

```js
const isWifeOfHusband = me?.spouse === 'husband' || me?.household;

if (isHusbandViewer) { 府内 / 相好 / 常来往 / 其他人 }
else if (isWifeOfHusband) { 我的人（王甯）/ 王家 / 我的人（自己）/ 其他人 }
else {                       // 独立市井平民
  我的人（自己或配偶）/ 王东家 / 王府家眷 / 熟人 / 其他人
}
```

**头衔**：非他妻妾的人看到王甯时，`role` 显示 **「临江茶坊少东家」**，不再显示"相公"。

**身份卡（`member-card.js`）** 同步：

```
亲眷：  【王甯】你的丈夫（临江茶坊东家）……
非亲眷：【王甯】临江茶坊东家王掌柜，与你并无婚配、也无亲缘……
        绝不许把他说成你的相公，也不许自称王家人。
```

**提示词（`pet-service.js`）** 同步加身份铁律：玩家是谁、不是王甯、非亲眷不许说"你相公"、不许替她编夫君宅院。

**实测**：新号菜单里王甯 → `group=王东家`、`role=临江茶坊少东家`；"我的人"里 **空**。

---

### ③ 隔空搭话 —— 已治本

**病灶**：只要喊"王甯/王掌柜/相公"，身在其他地点的王甯就会隔空应声。

**改法（`src/pet-service.js`）**：整段远程应声代码移除，改为一条铁律注释：

```js
// 物理在场铁律：不在同一地点的人，绝不隔空搭话（此前的远程应声已移除）
```

**效果**：

```
离析在于家酒肆说话，人在王宅正房的王甯不会应声；
婉儿/芸娘隔着地方喊"相公"，也同样不会隔空应——物理在场优先。
```

---

### 验证

| 项 | 结果 |
|---|---|
| `node --check`（server/pet-service/member-card） | 通过 |
| `flutter analyze` | 0 issues |
| `python scripts/regress.py` | **20/20** |
| 新号 `/api/me` 的 household | **null** ✅ |
| 新号菜单里王甯 | `王东家` / `临江茶坊少东家` ✅ |
| 新号"我的人" | 空 ✅ |
| 跨地点应声 | 已移除 ✅ |
| 线上热更新 | `/health` 正常 |
| 安卓包 | 已重打覆盖桌面（18:00） |

---

### 说明

1. **没有写死"离析"这个名字**：全部按 `household / spouse / parents` 判定，任何新号同一套规则。
2. **他的妻妾不受影响**：婉儿/芸娘/小翠仍归"我的人"，身份卡仍写"你的丈夫"。
3. **代价**：远程应声移除后，隔着地方喊人不会再有人应——这是任务单要求的"严格物理在场"，若你希望恢复"妻子隔空应一声"，需单独开口子（我会按亲缘判定）。

'''

anchor = '## 📋 历史交付记录汇总'
if anchor in s:
    s = s.replace(anchor, report + '\n' + anchor, 1)
    print('② 插入完成报告')

io.open(p, 'w', encoding='utf-8').write(s)
