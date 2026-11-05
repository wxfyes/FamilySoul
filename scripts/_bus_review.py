import io, re
p = 'docs/COLLAB_BUS.md'
s = io.open(p, encoding='utf-8').read()

new_json = '''```json
{
  "status": "READY_FOR_REVIEW",
  "last_updated": "2026-11-05 20:05",
  "active_task": "复核审查官本轮重构（群戏/差事离场/何顺ID）+ 返修三处未生效的物理联动",
  "priority": "HIGH_BUG_FIX",
  "changed_files": [
    "src/world/places-target.js（新增）",
    "src/world/summon.js",
    "src/pet-service.js",
    "src/world/clock.js"
  ],
  "server_status": "PROD_DEPLOYED_200_OK",
  "regression_tests": "20/20 PASSED",
  "client_reinstall_needed": false,
  "reviewer_action": "请审查信箱"
}
```'''
s = re.sub(r'```json\n\{[\s\S]*?\}\n```', new_json, s, count=1)

report = '''

---

## ✅ 复核与返修报告（2026-11-05 20:05 · READY_FOR_REVIEW）

### 一、审查官本轮修得对的部分（保留）

1. **群戏提示词**（提示词强化层）：删掉"必须同轮让被请的人到场开口""旁人必须插一句帮衬"，
   改为"每轮 1~2 人开口 / 严禁排队报幕 / 异地不许同轮现身"。**这是真正的病根修复，未动。**
2. **何顺英文 ID**：`clock.js` 反查真实姓名。方向对，但兜底仍写死 `'何顺'`，已改为按数据查。

### 二、返修：三处"没生效"的物理联动

#### 🔴 ① 回房目标地点不存在 → 人根本没动

- **病灶**：`east_wing` / `backyard` / `tea_mountain` 在 `world.places` 里**都不存在**
  （线上真实是 `wang_mansion_east` 西厢房、`wang_mansion_west` 等）。
  于是 `moveActor` 失败，但 `activity`、`left` 照写 —— "说回房、账上写回房、人还在正房"。
- **修法**：新增 `src/world/places-target.js`，**"去哪儿"唯一出处**：

```
resolvePlaceTarget(world, hint, { nearId, actor })
  ① 台词里直接点了地名 → 按名字找
  ② 语义词（酒楼/码头/茶山/东厢/西厢/后院/官仓/衙门/客栈/街市）→ 按地点名匹配
     · 名字含原话的 +6；边角地点（茶/摊/铺/店/集）+6 反向 -5
  ③ 室内去处（房/厢/院/阁/厨/库）→ 只在自己的宅院里找，找不到回自己家
  ④ 兜底：街市 → 自己家 → 任一非私宅
```

**实测解析结果**：

```
后院/下房/东厢/西厢房 → 临江·王宅·西厢房
酒楼   → 运河码头三层大酒楼
码头   → 运河码头
衙门   → 临江县衙（不再认成"县衙前茶摊"）
街市   → 青石板长街
```

#### 🔴 ② `who.location = dest` 绕过单一写入口

- **病灶**：`pet-service.js:694` 直接赋值，dest 可能是虚空地点（`tea_mountain`）。
- **修法**：一律 `moveActor(world, id, dest, 'world', 理由)`，并**检查返回值**；
  失败就 `console.warn` 且不写 `away/activity`。差事、离场两条路径都改了。

#### 🔴 ③ 离场靠正则偷听台词（与 AGENTS 六.2 冲突）

- **病灶**：`isGoingOut` / `isRetiring` 正则匹配正文，"奴婢这就去倒茶"也会命中。
- **修法**：**改成标签驱动** —— 天道真要谁走，就在末尾写：

```
[[depart:小翠|下房]]
[[depart:林芸娘|酒楼]]
```

引擎解析标签 → `resolvePlaceTarget` → `moveActor` → 写 `activity`，出府再写 `away`。
**台词里出现"退下/这就去"只当台词，不动人。**
并且把"离场处理"移到"标签清洗"之前（原来标签先被统一删掉，导致新逻辑永远收不到）。

**实测**：

```
[[depart:小翠|下房]]     → 小翠 到 临江·王宅·西厢房 ✅
[[depart:林芸娘|酒楼]]   → 芸娘 到 运河码头三层大酒楼 ✅
"奴婢这就去倒茶"（无标签）→ 位移 0 次 ✅
```

#### 🟠 ④ `away` 只写不回收

- **修法**：`clock.js` 每小时 `sweepAway()`：`away.untilDay` 过期即销账，并清掉残留的"出差"activity。

#### 🟠 ⑤ 残留名字硬编码

- `cleanAsName === 'heshun' ? '何顺' : '伙计'` → 改为按 `world.actors` 反查；查不到用身份，不写死人名。
- `/婉儿|芸娘|柳儿/` 判女眷 → 改为 `actor.household || actor.spouse === 'husband'`（按数据判亲缘）。

### 三、验证

| 项 | 结果 |
|---|---|
| `node --check`（places-target / summon / pet-service / clock） | 通过 |
| `python scripts/regress.py` | **20/20** |
| 地点解析（后院/酒楼/码头/衙门/街市） | 全部落到真实地点 ✅ |
| 标签离场（小翠 / 芸娘） | 真实移动并写 activity ✅ |
| 无标签台词 | 不做任何位移 ✅ |
| 线上热更新 | `/health` 正常 |
| 客户端 | 无需重装 |

### 四、诚实说明

1. **世界上目前没有"后院/花园/茶山"这些独立地点**，所以"后院"会落到王宅唯一的内院（西厢房）、"茶山"会落到街市。
   要真正分房分院，得让地点数据里长出"后院花园/紫阳山茶山"，而不是在代码里造别名。
2. **`away` 只在本轮离场里写**；从私宅走到别的非私宅（如从茶坊去酒楼）不算"出府"，不会写 away——按语义这是对的。
3. **群戏提示词没有动**，本轮只修物理层。
'''

anchor = '## 🚦 状态机流转规则'
if '复核与返修报告（2026-11-05 20:05' not in s:
    s = s.replace(anchor, report + '\n' + anchor, 1)
    print('bus 报告已写入')
io.open(p, 'w', encoding='utf-8').write(s)
