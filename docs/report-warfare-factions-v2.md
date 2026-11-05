# 兵权 · 夺城 · 势力 · 推演 · 托管 · 信息流 —— 完成报告（v2 全量）

> 本轮把上一个 AI 提的三条建议（粮道 / 沙箱过滤 / 信息流），
> 以及上一版报告里"还没做的六项"，**一次性全部接上**。
> 状态：**服务端全部落地并上线；客户端（App）界面未做**
> 回归：`python scripts/regress.py` → **20/20**；线上 `/health` 正常；未推送 GitHub

---

## 一、这轮一共动了 7 个文件

| 文件 | 职责 |
|---|---|
| `src/world/geography.js`（新） | 路与关隘：能不能到、要几天、卡在哪 |
| `src/world/factions.js` | 势力表 + 外交关系 + 驻地表 `stationed` |
| `src/world/warfare.js`（重写） | 募兵/买粮/军饷/粮道/行军/围城/招降/修城/调防/粮转军粮 |
| `src/world/strategy.js` | 规则推演（避盟友、先行军后攻城）+ 天道决策执行 + 枭雄自生 |
| `src/world/clock.js` | 每日军需、行军抵达、产粮、大事转风闻、枭雄自生 |
| `src/pet-service.js` | 注入【近来天下大事】：世界在走，相公得知道 |
| `src/server.js` | 兵权/外交接口、势力与驻扎写入世界负载 |

---

## 二、粮道（对应建议 1）

### 兵有驻地，不再是"悬空的兵"

```js
f.stationed = { 临江府: 65 }   // 兵站在哪座城
f.stationed 是唯一真相，f.troops = 各城之和（自动汇总）
```

**募兵落在自己的城**（没有城就落在临江府）；`station` 可在自己控制的城之间调防。

### 城有粮仓

```js
world.cities[城].grain   // 石
```

**买粮直接入城仓**（`buyGrain(world, fid, shi, city)`）。

### 军粮先吃城仓，再吃随军粮

```
每日：每个驻地按兵数扣城仓
城仓不够 → 扣 f.grain（随军）
两样都不够 → 士气 -3，事件「军中缺粮」
```

### 玩家的粮栈能变成军粮

```
粮/米/栈类产业，每日按进项攒 grainStock（income×2 石/日）
transfer 接口把 grainStock 调进某座城的仓
→ 你说的"一仓米 = 一支兵"，现在成立了
```

### 行军要吃随军粮

```
行军前按「兵数 × 0.02 石 × (路数+2)」预扣
粮不够 → 走不了（不是走一半饿死，是压根不让你出发）
```

---

## 三、路与关卡（对应建议 2）

`geography.js` 只回答三个问题：

```
① 同道诸城：一天可达
② 跨道：必须经过目标道的关隘城（defense 最高的那座）
③ 关隘是别人的：relation < 40 不放行 → 返回「XX由YY把守，不放你过」
```

**所以"关外豪强瞬移打临江"这种事，引擎会直接驳回**（若不同道且关隘在别人手里）。

**行军是"在路上"的**：`march` 返回 `days` 与 `arriveDay`，兵每天按日推进，到了才落到目标城，之后才能 `siege`。

---

## 四、夺城（唯一写入口）

```
围城：必须在该城有驻军（行军到了才算）
      战力 × 0.8~1.3 运气 vs 城防(defense + garrison×1.2)
破城：城易主、城防降到 6 成、民心 +10、回补 75% 兵
失败：城防降到 8.5 成、士气 -8、出兵全损
```

`ct.owner` 只在 `besiege` / `bribeCity` / 枭雄自生 三处被改。

---

## 五、外交与自立（补上"六项"里的①②）

```
POST /api/world/diplomacy
  { action:'ally',   faction:'canal' }   结盟（双方关系 +60）
  { action:'break',  faction:'canal' }   断交（-30）
  { action:'gift',   faction:'canal', amount } 赠礼（对方好感 +amount/10）
  { action:'proclaim', name:'临江' }      称制建国（需据 3 城，朝廷关系 -60）
```

**规则推演会避让盟友**：`relation >= 40` 的势力，AI 不攻打。

---

## 六、枭雄自生（补上"六项"里的③）

```js
// 每 30 世界日，民怨 >= 55 的朝廷城，50% 概率有人竖旗
世界 factions 里新增：{ kind:'warlord', troops: 城防×3, grain: 兵×2, ambition: 85, stance:'expand' }
该城 owner 改为新势力，民心 -10，发事件 warlord_spawn
```

**没有真人、没有天道，世界照样会长出割据者。**

---

## 七、信息流（对应建议 3）

**① 天道现在看得到"近来天下大事"**

```
（【近来天下大事】第17日朝廷拨下 150000 两赈灾银，巨款层层漂没…；
  第18日临江王家破临江府…。这些事已经发生，若有人问起，照此说，不许另编。）
```

**② 大事自动变市井风闻**

```
破城 / 攻城失败 / 枭雄自立 / 民变 / 灾荒 / 国库告罄 / 赈灾不足
→ 自动写进 world.rumors，按现有"谁知道"机制传给在场的人
```

**所以你在家喝茶，茶坊客商会说"北边周将军自立了"，芸娘会嘟囔"漕船进不来，菜油贵了"——因为事实确实进了她嘴里。**

---

## 八、接口总表

```
POST /api/world/military   { action, ... }
  recruit  { count, city }        募兵（落到城里）
  grain    { shi, city }          买粮入城仓
  march    { from, city, troops } 行军（按路走，几天到）
  station  { from, city, troops } 自己城之间调防
  siege    { city, troops }       围城（须在该城有兵）
  bribe    { city, amount }       招降
  fortify  { city, amount }       修城
  transfer { prop, city, shi }    产业粮 → 军仓
  army     {}                     看兵力与驻扎

POST /api/world/diplomacy  { action, faction, amount, name }
  ally / break / gift / proclaim
```

**世界负载新增**：`factions[].stationed`、`factions[].marches`。

---

## 九、验证记录

| 项 | 结果 |
|---|---|
| `node --check`（7 文件） | 通过 |
| 回归 | **20/20** |
| 买粮入城仓 | ok，200 石入临江府，扣 120 两 |
| 募兵落城 | ok，40 兵，总兵 85，stationed 临江府 85 |
| 行军 | ok，days=1，arriveDay=380 |
| 调防/兵力查询 | ok，stationed 正确汇总 |
| 结盟 | ok：临江王家与运河漕帮结为盟好 |
| 赠礼 | ok：赠 30 两 |
| 断交 | ok |
| 称制门槛 | 正确驳回：至少三城（现有 1 城） |
| 线上部署 | `/health` 正常，四势力带兵/粮/城 |

---

## 十、仍然没做的

1. **App 界面**：兵权/外交只有接口，App 里没有按钮与地图（服务端已就绪，客户端要重打）。
2. **GLM 决策的"守军/粮道"细节**：天道推演给的 `fortify` 目前被忽略（返回"暂未开放"）。
3. **枭雄自生未在线上跑到 30 日**，只在代码层验证；需要一次 30 日推演才能看到真实结果。
4. **关隘是"每道 defense 最高的城"**——这是简化，未来应做成数据里的 `gateway: true`。
5. **多势力外交网**（A 结盟 B、B 又打 C 的连环）只做了两两关系，没有"盟友的盟友"。

---

## 十一、提交记录（本地，未推送）

```
feat(war): 兵权/夺城/势力/推演/托管/信息流 v2
  · geography.js 路与关隘；warfare.js 重写（驻地/粮道/行军/围城唯一入口）
  · factions.js 外交关系与驻地表；strategy.js 枭雄自生与避让盟友
  · clock.js 军需/抵达/产粮/大事转风闻；pet-service 注入近来天下大事
  · server 兵权与外交接口、势力负载带驻扎与行军
```
