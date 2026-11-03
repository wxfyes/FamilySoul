import io
p = 'docs/military-marriage-power.md'
s = io.open(p, encoding='utf-8').read()

add = '''

---

# 第八部分 · 现状审计与看板缺口（2026-11-03 实查）

> 以源码为准，逐条对照前七部分。
> 审计方式：只读代码检索，不含推测。

## 一、实现状态总表

| 系统 | 状态 | 证据（位置） |
|---|---|---|
| 联姻 COURT | ✅ 能用 | `dispatch.js:446-463`（写名分、household、marriages、大事记） |
| 党争骨架 | ✅ 骨架 | `state.js:437` factions 种子、`dispatch.js:413` ally、弹劾见 `clock.js` memorials（9 处） |
| 粮 | ✅ 能用 | `clock.js` 物价回归/季节/天灾/秋收/灾荒出仓 |
| 晨报 | ✅ 能用 | `clock.js buildMorningReport`（0 token，优先读 rumors） |
| 名分位次 | ✅ 能用 | rank 写入 + household + milestones |
| 码头 | 🟡 部分 | 地点与引用有，缺吞吐/抽成/帮口经济 |
| 盐 | 🟡 部分 | 仅律文「私盐者杖一百、流三千里」+ 城市特产标签，缺盐引/贩运 |
| 牙行 | 🟡 部分 | 仅行会名（曹当），缺抽佣/担保 |
| 灾荒 | 🟡 部分 | 天灾会随机发生，缺流民/民变/赈灾决策链 |
| 军法 EXECUTE | ❌ 未做 | 全仓 0 处 |
| 钱庄 | ❌ 未做 | 全仓 0 处 |
| 快照/回滚 | ❌ 未做 | 只有 `scripts/backup.mjs` 备份，无一键恢复 |
| 事务补偿 | ❌ 未做 | — |
| 人才雇佣 | ❌ 未做 | 无 loyalty / skills |
| 律例刑罚梯度 | ❌ 未做 | 只有私盐一条 |
| 宗族丧葬 | ❌ 未做 | 无族谱/守孝/丁忧 |
| 情报暗线 | ❌ 未做 | 0 处 |
| 外交深水区 | ❌ 未做 | 三国设定有，玩法浅 |

**完成度（按权重）：约 35~40%。**

## 二、必须修的三个点（都是"会出戏"级别）

### ① 「去X家」不再被识别为移动

```
去苏娘家   → CHAT | target: -
去紫嫣那儿 → CHAT | target: -
去婉儿屋里 → CHAT | target: -
```

**根因**：`intent.js` 的地名正则只认「馆/铺/楼/坊/堂/店/院…」，不认「家/那儿/屋里」；旧的 `applySummon` 分支已被新管道绕过。

**改法**：

```
MOVE 解析加一跳：
  匹配 /(?:去|到|往)([\\u4e00-\\u9fa5]{2,3})(?:家|那儿|屋里|处)/
  → 用名字去 world.actors 找人对上
  → 命中：target = 该 actor 所在地点名
  → 未命中：才走造景
```

### ② 新娶妇人的 home 指向死地点

```js
// dispatch.js:448
actor.home = 'warm_pavilion';   // 该 id 在世界中不存在
```

**改法**：改为 `backyard`（后院暖阁）。

### ③ 同行名单未持久化

```
world.party 全仓 0 处
```

**后果**：说"带紫嫣去客栈"她能跟；下一句"去街上"（没点名）她就掉队。

**改法**：`world.party = { husband: ['liuwenxia'] }`，靠"带上 X / 你留下"增删。

## 三、看板缺口（当前完全没露）

### 3.1 现状

```
看板已有 20 张卡：运行状态/花费/家底/体检/势力兵力/城中动静/趋势/
                盘点/大事记/关系网/街面风评/案子/天下(行会外交驻军)/
                朝中(官职)/山川/城池/基础设施

看板没有：派系 联姻 钱庄 牙行 盐 码头经济 军法 晨报 家宅 账目 军中
```

### 3.2 接口要补的字段

`GET /api/admin/world` 目前缺：

```js
factions: world.factions,                       // 派系
marriages: world.marriages || [],               // 迎娶记录
grain: { price: world.grainPrice, stock: world.court?.grain },
digest: world.lastDigest || null,               // 最新晨报
```

### 3.3 看板要加的四张卡

| 卡 | 顶部一行 | 明细 |
|---|---|---|
| **家宅** | 正妻 1 · 侧室 2 · 有孕 1 | 名分位次表（谁、什么位、住哪、有无身孕、子女） |
| **账目** | 现存 644 两 · 日入 10.8 两 | 产业列表（日入、掌柜、状态）、借贷、月支 |
| **朝堂** | 官职 3 · 派系 2 | 品级、派系势力条、折子状态 |
| **军中** | 兵 300 · 士气 60 | 驻军、行军、战役进度、军饷 |

### 3.4 晨报放哪

```
看板最顶部一行（不占卡片）：
第15日 · 阿吉：昨日进账 10.8 两；城里风闻……
```

**点一下可展开全文。**

### 3.5 实施顺序

```
1. 家宅（marriages + pregnancy）—— 每天要看
2. 账目（assets 已有）—— 改造成卡片
3. 朝堂（需先补 factions 接口）
4. 军中（等真打仗再上）
```

**钱庄 / 盐 / 牙行还没实现，看板不提前做，等系统有了再上卡。**

## 四、尚未完成的前置项（来自第七部分）

```
P0-0.1 降本：historyTurns 已 8→4；缓存友好化未做（仍全价重算）
P0-0.3 快照：只有备份，无一键回滚
P1-1.1 事务补偿：未做
P1-1.3 每日对账：audit 有，但未覆盖金融流水
双真人 pendingRoom：未做
客户端消费 version：未做
```

## 五、验收清单（本轮改完请逐条自查）

```
① 说"去苏娘家" → 人真的到苏娘的绣坊
② 娶新人进门 → 她的 home 是可用的真实地点（不是 warm_pavilion）
③ 说"带紫嫣去客栈"再"去街上" → 她仍跟着（party 生效）
④ 看板出现「家宅」「账目」两张卡，数据与实际一致
⑤ /api/admin/world 含 factions / marriages / grain / digest
⑥ 跑 test/test-gate|apply|party-flow|server + scripts/regress.py 全绿
```
'''

if '第八部分 · 现状审计' not in s:
    io.open(p, 'w', encoding='utf-8').write(s.rstrip() + add)
    print('appended audit part 8')
else:
    print('exists')
