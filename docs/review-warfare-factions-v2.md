# 兵权 · 夺城 · 势力 · 天下推演 v2 深度架构审查报告

> **审查定位**：独立架构师深度审阅  
> **审查对象**：`docs/report-warfare-factions-v2.md` 及实际提交 `0b1d411`（7 个关联文件）  
> **核心原则**：不打补丁，有病治根（修架构、修单一入口、修规则闭环）  
> **状态核验**：回归测试 20/20 维持通过，代码整体骨架扎实，但存在**两处严重逻辑死锁与两处状态未闭环隐患**，需立即纠偏。

---

## 一、 整体肯定：骨架合格之处

1. **兵粮真实绑定**：募兵自带 0.5 石口粮，军粮按驻扎地先扣城仓、再扣随军粮，缺饷缺粮触发士气暴跌与逃兵机制。彻底杜绝了凭空刷兵。
2. **唯一资金真相**：相公出兵、买粮、招降严格消耗 `world.assets.silver`，不另设虚拟代币，与既定经济账本保持自洽。
3. **玩家托管不送死**：推演逻辑中对 `kind === 'player'` 做了物理防呆，相公不在场时默认守成，不盲目乱打。

---

## 二、 核心硬伤与致命逻辑缺陷（必须治本）

### 🔴 硬伤一：天道决策与物理引擎彻底脱节（天道攻城指令 100% 失败）

- **事实代码定位**：
  - `src/world/strategy.js:106`（大模型 Prompt）：
    ```text
    {"faction":"势力id","action":"recruit|buy_grain|besiege|bribe|fortify|hold","target":"城名或空","amount":数字,"reason":"一句话理由"}
    ```
    大模型允许下达的动作集只有：`recruit`, `buy_grain`, `besiege`, `bribe`, `fortify`, `hold`，**压根没有 `march`（行军）**。
  - `src/world/warfare.js:218-219`（攻城校验）：
    ```javascript
    const here = troopsAt(world, f, cityName);
    if (here < 1) return { ok: false, error: `${cityName}没有你的兵，先派人过去` };
    ```
    物理引擎强制要求：**想打目标城，该城必须已经有你的驻军**。
  - `src/world/strategy.js:144`（天道决策落地）：
    直接调用 `besiege(world, { attacker: fid, cityName: target, troops: amount })`。

- **死锁后果**：
  天道深思熟虑后给出决策：“漕帮派 50 兵攻打扬州府”。
  引擎一查：漕帮当前在扬州府驻兵为 0，**直接驳回并报错**：`扬州府没有你的兵，先派人过去`！
  **结果：大模型给出的所有跨城攻城（besiege）意图，100% 被引擎当作非法操作拦截，天道在整个推演生涯中一辈子也攻不下一座城！**

- **根治方案**：
  在 `applyStrategyDecisions` 接收到 `action === 'besiege'` 时：
  检查目标城是否有本方驻军。若驻军不足或为 0，**引擎应自动将其降级转换为从最近驻地开拔的 `march`（行军指令）**，待行军到达后再执行攻城；或者在 Prompt 中明确扩充 `march` 意图规范。

---

### 🔴 硬伤二：城市易主破坏单一真相源（原所有者未剔除，领地幽灵并存）

- **事实代码定位**：
  - `src/world/warfare.js:231-236`（破城）：
    ```javascript
    ct.owner = attacker;
    f.cities = Array.isArray(f.cities) ? f.cities : [];
    if (!f.cities.includes(cityName)) f.cities.push(cityName);
    ```
  - `src/world/warfare.js:256-259`（招降）以及 `src/world/strategy.js:187`（枭雄自立）：
    均只把城池 push 给了新势力。

- **严重后果**：
  **被夺走城池的前任势力（如朝廷 `court` 或上一个占领者），其 `cities` 数组从未被清除该城！**
  例如：临江府原本属于朝廷 `court.cities`。王家破城后，王家拥有了临江府，但朝廷的 `court.cities` 依然包含临江府；
  若后续漕帮再攻下临江府，漕帮、王家、朝廷三方势力**同时声称拥有该城**，违背了“单一事实账本”军规。

- **根治方案**：
  彻底禁止在各处散落修改 `ct.owner` 与 `f.cities.push`。
  抽象出唯一城市产权转移函数：
  ```javascript
  function changeCityOwner(world, cityName, newOwnerFid) {
    const oldOwnerFid = world.cities[cityName]?.owner || 'court';
    if (world.factions[oldOwnerFid]?.cities) {
      world.factions[oldOwnerFid].cities = world.factions[oldOwnerFid].cities.filter(c => c !== cityName);
    }
    world.cities[cityName].owner = newOwnerFid;
    const next = world.factions[newOwnerFid];
    if (next) {
      next.cities = Array.isArray(next.cities) ? next.cities : [];
      if (!next.cities.includes(cityName)) next.cities.push(cityName);
    }
  }
  ```

---

### 🟠 缺陷三：一维数组伪装二维地理（江南道寸步难行，去不了淮南）

- **事实代码定位**：
  `src/world/geography.js:31-39`：
  ```javascript
  export function neighborRegions(world, region) {
    const list = (world.geo?.regions || []).map((r) => r.name);
    const i = list.indexOf(region);
    if (i < 0) return [];
    const out = [];
    if (i > 0) out.push(list[i - 1]);
    if (i < list.length - 1) out.push(list[i + 1]);
    return out;
  }
  ```

- **荒谬现象**：
  在实际数据 `geo.regions` 中，列表顺序为：
  `['江南道', '京畿道', '淮南道', '河北道', '岭南道', '剑南道' ... '闽浙道', '江西道']`
  按 `i-1` 与 `i+1` 判定相邻：
  1. **江南道（索引 0）的邻居只有京畿道（索引 1）！**
     江南道要打淮南道、闽浙道、江西道，全部被代码直接判定为“隔着别的道，路不通”；
  2. 索引 4 的**岭南道（两广）**与索引 5 的**剑南道（四川）**居然成了直接相邻的接壤邻居。

- **根治方案**：
  不可使用一维数组索引偷懒。必须在 `geography.js` 中定义真实的古代各道邻接表（Adjacency Map）：
  ```javascript
  const REGION_ADJACENCY = {
    '江南道': ['淮南道', '闽浙道', '江西道', '京畿道'],
    '淮南道': ['江南道', '河南道', '淮北道', '京畿道'],
    '闽浙道': ['江南道', '江西道', '岭南道'],
    // ...
  };
  ```

---

### 🟡 隐患四：第 7 日推演双重叠加运行

- **事实代码定位**：
  1. `src/world/clock.js:1425`：在每日日结内部，`if (day % 7 === 0)` 强行跑了一次 `npcStrategyTurn(world, events)`（规则兜底）；
  2. `src/server.js:4072`：在 `onAfterTick` 回调中，`if (day0 % 7 === 0)` 又调用 LLM 跑了一次 `applyStrategyDecisions(w0, decisions)`。

- **后果**：
  第 7 天同时触发规则推演与天道推演，势力在同一天被两套逻辑轮番驱动，逻辑行为发生重复叠加。
  **建议**：若配置了大模型，规则推演仅作为 LLM 调用失败时的 fallback 降级通道，严禁同一天两套齐发。

---

### 🟡 隐患五：攻城战损仅 25%，优势方光速滚雪球

- **事实代码定位**：
  `src/world/warfare.js:228`：
  `setStationed(world, f, cityName, here - send + (win ? Math.round(send * 0.75) : 0));`
  破城后直接返还 75% 兵力。
  在冷兵器攻城战中，攻破坚城仅损耗 25% 兵力过于宽松。一旦某个割据势力滚到 200~300 兵力，可以在 2 个月内席卷数座城池，导致天下大势迅速崩盘。
  **建议**：攻城战损应更具代价，胜方生还率应降至 40%~50%（或随城防高低动态结算伤亡）。

---

## 三、 审查结论与整改清单

| 序号 | 缺陷项 | 级别 | 解决思路 |
|---|---|---|---|
| 1 | **天道推演攻城死锁** | 🔴 严重死锁 | 天道下达 `besiege` 时若未到该城，引擎自动转为 `march` 开拔 |
| 2 | **城市所有权未闭环** | 🔴 数据污染 | 封装单一写入口 `changeCityOwner`，原子化剔除旧主领地账本 |
| 3 | **一维伪邻近道** | 🟠 逻辑失真 | 将一维数组 `i±1` 改为真实地理接壤图 `REGION_ADJACENCY` |
| 4 | **推演双重触发** | 🟡 逻辑冗余 | 确立 LLM 为主力，规则推演纯作为失败时的降级 fallback |
| 5 | **攻城战损过低** | 🟡 数值失衡 | 攻城生还率调至合理区间，避免无脑横扫推图 |
| 6 | **移动端操作界面** | ⏳ 待交付 | 服务端就绪后，需在 Flutter 客户端抽屉中挂载调兵与军情面板 |

