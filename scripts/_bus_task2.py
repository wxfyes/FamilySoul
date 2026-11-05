import io, re
p = 'docs/COLLAB_BUS.md'
s = io.open(p, encoding='utf-8').read()

# 顶部状态
new_json = '''```json
{
  "status": "READY_FOR_REVIEW",
  "last_updated": "2026-11-05 18:35",
  "active_task": "代演乱认媳妇（人设硬编码）+ 过门人霸占私宅 —— 已按任务单两处治本",
  "priority": "HIGH_BUG_FIX",
  "changed_files": [
    "src/world/proxy-actor.js",
    "src/pet-service.js",
    "src/world/dwelling.js",
    "src/world/couples.js",
    "src/world/clock.js",
    "src/world/state.js",
    "src/server.js"
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

## ✅ 本轮完成报告（2026-11-05 18:35 · READY_FOR_REVIEW）

### 任务 1：代演乱认媳妇（人设硬编码）—— 已治本

**病根**：`proxy-actor.js` 按角色名硬写死三段人设，`于子归` 分支直接把**眼前人**当成媳妇：

```js
`你现在代演「于子归」——…紫嫣（${hearerName || '酒肆老板娘'}）明媒正娶的合法正牌糙汉丈夫！`
user 末尾还写死：「媳妇正在跟你说话…」
```

于是男号离析来求职，也被他揽腰叫"媳妇"。

**改法（关系动态化，不按姓名硬写）**：

```js
// 唯一出处：他与听者的关系
export function relationOf(actor, hearer) {
  if (actor.spouse === hearer.id) return 'spouse';
  if (actor.lovers?.includes(hearer.id)) return 'lover';
  const rel = actor.relations?.[hearer.id] || {};
  if (rel.lover || rel.intimacy === 'lover' || (rel.desire >= 70 && rel.trust >= 60)) return 'lover';
  if (actor.id === 'husband' && hearer.household) return 'household';
  ...
  return 'outsider';
}
```

**人设按「关系 × 行当」两类推出来**（不再有 `isYuZiGui` 这种名字特判）：

| 关系 | 于子归（工头/掌柜） | 王甯（东家） | 随科（书吏） |
|---|---|---|---|
| spouse / lover | 糙声疼媳妇、揽难处 | 温和体贴、账目商量 | 房里才有软话 |
| outsider | 问身板力气、谈工钱吃住 | 问客人要什么、多少价 | 客气按规矩 |

**并且给外人加了硬禁令**：

```
绝不可称对方"媳妇/娘子/宝贝"，绝不可动手动脚、揽腰拉手，
绝不可说"想你了"这类私房话。
```

**配套（这一条是关键，否则改了也没用）**：五个代演调用点全部传入 `hearer`：

```
pet-service.js:2511 hearer: mePost     （代演王甯）
pet-service.js:2629 hearer: mePost     （代演在场 NPC）
pet-service.js:3278 hearer: husN
pet-service.js:3379 hearer: meL
pet-service.js:3483 hearer: meM
```

**支持性改造（新增 `src/world/couples.js`）**：
线上 于子归/紫嫣、随科/静儿 原本没有 `spouse` 字段，关系判不出来。
现在按**角色描述 + 同住一处**一次性推出夫妻并写回双方 `spouse`（唯一事实源），
并顺手清掉"配偶指向已不存在的人"的悬空数据。

**线上实测**：

```
于子归.spouseId = liuwenxia（紫嫣）
静儿.spouseId   = npc_4（随科）
随科.spouseId   = zhanjing（静儿）
relationOf(于子归, 离析) = outsider  ✅
```

---

### 任务 2：过门人霸占私宅 —— 已治本

**病根**：`/api/world/opening` 立过门人时写死：

```js
home: a.location, location: a.location, schedule: []
```

把玩家私宅设成他的家、且没有作息 → 永久钉死。

**改法一（生成即合法，`src/server.js`）**：

```js
const isHomeOfPlayer = Boolean(world.places?.[a.location]?.residence);
const nearId = isHomeOfPlayer ? 'street' : a.location;
const ownHome = ensureDwelling(world, nid, whoName, nearId);   // 新建「柳婶家」，exits 接回长街
world.actors[nid].home = ownHome;
world.actors[nid].location = ...;
world.actors[nid].schedule = defaultSchedule(whoRole, nearId, ownHome);  // 不再空表
gender: inferGenderFromIdentity(...), age: inferAgeFromIdentity(...)
```

**改法二（私宅巡检，`src/world/dwelling.js` + `clock.js`）**：

```js
// 每小时一次
evictTrespassers(world, events, nextEvent)
  · 这宅子的人（主人 / 掌柜 / 王家眷属 / 雇工 / 自己家）→ 留
  · 不是这宅子的人 → 记 trespassHours
  · 待满 4 个时辰，或入夜（20 时后 / 5 时前）→ 走 moveActor 回自家或长街
```

**改法三（历史脏数据自愈）**：

```
repairTrespassHomes(world)：把"把别人私宅当自己家"的人
  → 新建自己的「某某家」、改 home、清 location、补作息
线上已执行：柳婶 home = house_3「柳婶家」，并搬回自己家中。
```

**判定收紧了**：`mayStayIn` 不再拿 `actor.home` 自证，必须"这宅子本来就是他的（无主或主人是他）"。

---

### 验证

| 项 | 结果 |
|---|---|
| `node --check`（proxy-actor / dwelling / couples / clock / state / server） | 通过 |
| `python scripts/regress.py` | **20/20** |
| `relationOf(于子归, 紫嫣)` | `spouse` ✅ |
| `relationOf(于子归, 离析)` | `outsider` ✅ |
| `mayStayIn(柳婶, 离析的小院)` | `false` ✅ |
| `mayStayIn(离析, 离析的小院)` | `true` ✅ |
| 线上 柳婶 | home=`house_3`「柳婶家」，不在玩家院里 ✅ |
| 线上 于子归/紫嫣、随科/静儿 | spouseId 双向正确 ✅ |
| 线上热更新 | `/health` 正常 |
| 客户端 | **无需重装**（改动全在服务端） |

---

### 说明

1. **没有写死任何角色名**：人设由 `relationOf()` + 行当关键词推出；夫妻由 `couples.js` 从数据推出。
2. **私宅巡检是每小时跑的规则**，不是针对柳婶的一次性补丁；任何 NPC 赖在任何私宅都会同样被请出。
3. **过门人的作息**按行当给（货郎/差役/妇人/一般），共 4~5 个时段，不再是空表。
4. **仍有待观察**：如果天道把某个 NPC 的 `role` 写成"某某的丈夫"但那人不在世界里，就推不出夫妻关系，需要靠后续补数据。
'''

anchor = '## 📜 历史完成存档'
if '本轮完成报告（2026-11-05 18:35' not in s:
    s = s.replace(anchor, report + '\n' + anchor, 1)
    print('已追加完成报告')
io.open(p, 'w', encoding='utf-8').write(s)
