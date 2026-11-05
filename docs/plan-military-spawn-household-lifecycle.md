# 军饷月结与危机深化 · 小家中馈柴米自洽 · 新人入世底座重构方案

> **编制基准**：《AGENTS.md》最高第一铁律（彻底禁止打补丁，修架构、修单一入口、修规则闭环）  
> **面向对象**：FamilySoul 核心开发 AI（请严格按本方案落地实现，严禁缩水）  
> **核心目标**：彻底解决“柴米油盐无人管、天道生活真空悬浮、DM长人生成空壳”的系统性底座缺失。

---

## 零、必须认清的架构本质

用户指出的核心痛点是：
1. **生活花销不能没人操心，但也不可能让相公每天去买酱油买醋**。必须由**天道建立【公中中馈月例银】自发运转体系**——月初天道自动划拨银两给主母沈婉儿操持内宅，平时谁也不用烦琐记账；有钱内宅安适，没钱触发典当危机，形成完整的烟火气闭环！
2. **新人进场底座不能是空壳**。目前 `demography.js` 已补充年轻人口，但天道 DM 临场长人（`dispatch.js: [[world:spawn]]`）依然缺少岁数、婚配与初始盘缠，必须由单一入口在生成时一次性完整赋权！
3. **大军博弈不能悬浮**。正规营兵不能在布衣阶段无门槛狂募；欠饷 3 个月哗变必须有概率洗劫府库反噬相公，形成真实政治经济博弈！

---

## 一、第一支柱：小家中馈柴米月例银（天道自动掌管生活花销）

### 1. 核心设计原则
- **微观全自动**：平时任何角色与相公都不用手动买米买油买炭；
- **宏观按月扣**：每月初一（与军饷同日，`day % 30 === 0`），天道自发从相公公中（`world.assets.silver`）划拨 **中馈月例银（默认 4.0 两/月）** 给主母沈婉儿；
- **危机自洽演进**：公中有钱则家宅和睦，公中无钱则触发分级内宅危机。

### 2. 数据结构规范（`world.assets`）
```json
{
  "silver": 128.5,
  "householdAllowance": 4.0,
  "householdArrears": {
    "months": 0,
    "owed": 0.0
  }
}
```

### 3. 时钟挂接与状态机（`src/world/clock.js: onNewDay`）
每月初一（`day % 30 === 0`）与 `runPayday` 并行触发 `runHouseholdPayday(world, events)`：

- **情境 A：足额划拨（`silver >= householdAllowance`）**：
  - 扣除银两：`silver -= allowance`；
  - 若此前有积欠（`householdArrears.months > 0`）：
    - 扣清积欠或提示补齐，清零 `householdArrears`；
    - 生成事件：`【中馈】月初公中拨足银两并补齐旧欠，婉儿喜逐颜开，采买绸缎细米，内宅欢欣。`；
    - 妻妾（沈婉儿、林芸娘等府内眷属）好感提升，怨怼清零；
  - 若日常正常发放：
    - 生成事件：`【中馈】月初发下公中月例银 四两，婉儿操持采办应季柴炭米粮，内宅井井有条。`；
    - 眷属心境安稳，日常闲聊可自然引用应季柴米（如冬日暖炉、春日新茶）。

- **情境 B：短缺欠发（`silver < householdAllowance` 进入危机状态机）**：
  - `householdArrears.months += 1`；
  - `householdArrears.owed += allowance`；
  - **欠 1 个月（暗中典当）**：
    - 主母婉儿隐忍持家，事件：`【中馈】公中银两短缺，月例未发。婉儿暗中典当旧素银钗贴补米面柴火，内宅暗生愁容。`；
    - 眷属怨怼 `grievance += 5`；
  - **欠 2 个月（下人议论）**：
    - 府内用度紧缩，事件：`【中馈】公中已两月未发月钱，丫鬟小厮私下私语相公家道中落，冬日炭火减半。`；
    - 眷属怨怼 `grievance += 10`，市井流传微弱风闻：*“听说王相公府上近来手头颇紧…”*；
  - **欠 3 个月及以上（内宅裂痕）**：
    - 粗茶淡饭，生计艰难，事件：`【中馈】公中三月无粮饷银米，丫鬟告假离府，芸娘垂泪，内宅生计维艰。`；
    - 妻妾信任 `trust -= 15`，怨怼大增。

### 4. 补发与贴补接口（`src/server.js`）
- 提供 `POST /api/world/household { action: 'pay_arrears' }`：
  - 相公手头有银子时可一键补齐积欠月例，补齐后眷属怨怼平复，生成事件：`相公拿出银两贴补内宅，婉儿重掌中馈，家宅复归安泰。`
- 在 `GET /api/me` 和 Web 看板中输出 `householdAllowance` 与 `householdArrears`，让相公随时掌握家计。

---

## 二、第二支柱：DM 临场入世 `spawn` 彻底厚实化（`src/world/dispatch.js`）

### 1. 现存 Bug 与病因分析
- 在 `src/world/dispatch.js` 的 `kind === 'spawn'` 分支中，天道 DM 临时长人时只赋了 `id`、`name`、`role`、`location`、`home`、`goals`，**完全漏掉了 `age`、`gender`（部分逻辑仍可能留空）、`marital` 和 `money`**！
- 这导致生成的角色岁数为空，随身一文不名，直到事后读档被 `heal.js` 补齐，严重违反了“单一写入口”原则。

### 2. 彻底治本修法（`dispatch.js`）
在 `world.actors[id] = { ... }` 写入时，必须无条件调用现成的全套推断规则一次性赋予完整人格底座：

```javascript
// 1. 性别（严禁 unknown）
const gender = inferGenderFromIdentity(name, args.role, args.gender || 'male');

// 2. 年龄（根据行当与姓名自然推断，绝不允许留空）
const age = inferAgeFromIdentity(name, args.role, gender, id);

// 3. 婚配（按古代世情梯次自然推断）
const marital = inferMaritalStatus(name, args.role, age, gender);

// 4. 初始盘缠（根据身份行当赋予真实碎银，绝不空腹入世）
const money = (() => {
  const r = String(args.role || '');
  if (/客商|掌柜|东家|盐商|富商/.test(r)) return Math.round((8 + Math.random() * 15) * 10) / 10; // 8~23两
  if (/郎中|教书|相士|捕头|镖头/.test(r)) return Math.round((3 + Math.random() * 5) * 10) / 10;   // 3~8两
  if (/小贩|货郎|绣娘|帮佣|伙计|茶博士/.test(r)) return Math.round((1 + Math.random() * 2) * 10) / 10; // 1~3两
  if (/流民|乞儿|叫花子/.test(r)) return Math.round(Math.random() * 0.3 * 100) / 100;           // 0~0.3两
  return Math.round((1 + Math.random() * 3) * 10) / 10; // 默认 1~4两
})();

// 5. 初始社会关系（不再只有 husband 孤悬一人）
const relations = {
  husband: { trust: 50, desire: 30, fear: 0, grievance: 0 }
};
// 从同地点或街坊中挑选一位已有 NPC，建立街坊或旧识关系
const neighbors = Object.values(world.actors || {}).filter(a => a && !a.dead && a.id !== id && (a.location === assignedLoc || a.home === assignedHome));
if (neighbors.length > 0) {
  const peer = neighbors[Math.floor(Math.random() * neighbors.length)];
  relations[peer.id] = { trust: 60, relation: '街坊' };
  peer.relations = peer.relations || {};
  peer.relations[id] = { trust: 60, relation: '街坊' };
}
```

---

## 三、第三支柱：兵制深化（营兵准入门槛与哗变反噬）

### 1. 正规野战营兵（`army`）准入门槛（`src/world/warfare.js: callToArms`）
- **常理规则**：
  - 家丁（`guard`，看家护院）与护院（`retainer`，武师镖客）属于豪门家眷私卫，布衣大贾亦可私雇；
  - **营兵（`army`，执坚披甲的经制大军）**：私蓄甲士在古代等同谋逆！
- **代码实现**：
  - 招募 `kind === 'army'` 时，必须校验：
    - 相公势力 `f.cities` 拥有至少一座城池（据有一方）；
    - 或相公拥有官方武职/朝廷授衔（`world.appointments` 中有相关武职）；
  - 若皆无，则返回拒绝：`{ ok: false, error: '未奉朝命或未据城池，擅募野战营兵形同聚众谋逆！目前只可招募家丁与护院。' }`。

### 2. 欠饷 3 个月哗变反噬府库（`src/world/warfare.js: runPayday`）
- 当欠饷达到 3 个月触发 `mutiny` 哗变时：
  - 溃散 25% 兵力；
  - 所在城池民怨上升（`unrest + 10`）；
  - **新增反噬逻辑**：有 30% 概率溃兵啸聚洗劫军资：
    - 若驻地城池有公粮，劫走 `Math.min(num(ct.grain), 50)` 石；
    - 或若相公府库有余银，劫掠走少量余银（不超过 50 两），并发布天道公开事件：
      `【营中哗变】欠饷三月，溃兵洗劫了驻地府库并呼啸散去，地方震动！`

---

## 四、落地实施清单与验证要求

1. **修改文件**：
   - `src/world/clock.js`：挂接每月初一 `runHouseholdPayday`，驱动中馈月例银与危机状态机；
   - `src/world/dispatch.js`：重构 `kind === 'spawn'`，当场赋予岁数、性别、婚配、初始盘缠与街坊关系；
   - `src/world/warfare.js`：营兵准入门槛校验、欠饷 3 月哗变反噬洗劫；
   - `src/server.js`：增加中馈补欠接口 `POST /api/world/household { action: 'pay_arrears' }`，在 `/api/me` 返回 `householdAllowance` 与 `householdArrears`；
   - `mobile/lib/views/army_sheet.dart`（如有需要）或相应前端看板展示公中月例。
2. **严禁打补丁**：
   - 严禁对沈婉儿、林芸娘写写死特判；
   - 严禁出现“先生成空壳再靠 heal 修正”的伪修复；
3. **交付验收要求**：
   - 语法检查：`node --check` 必须全数通过；
   - 本地自测：验证初一自动扣除中馈月例银、欠费危机事件生成、`[[world:spawn]]` 人物数据完整、营兵门槛拦截；
   - 回归测试：`python scripts/regress.py` 必须保持 **20 / 20 项全绿**；
   - 编写整改汇报文档：`docs/report-household-and-spawn-fixes.md` 供审查官复审。

---

## 五、落地实况（v1.1 · 已实现部分）

> 本节由执行方补充：方案一旦落地，就在这里标记状态，避免文档与代码脱节。

| 方案条目 | 状态 | 落点 |
|---|---|---|
| 中馈月例银（4 两/月，月初划拨） | ✅ 已实现 | `clock.js#runHouseholdPayday` |
| 中馈欠拨三级危机（1/2/3 月） | ✅ 已实现 | 同上（怨怼 +5/+10/+15，3 月信任 -15） |
| 中馈补欠接口 | ✅ 已实现 | `POST /api/world/household { action:'pay_arrears' }` |
| 中馈字段进负载 | ✅ 已实现 | `/api/me` 的 `household: { allowance, arrears, silver }` |
| spawn 补齐性别/年龄/婚配 | ✅ 已实现 | `dispatch.js`（走 `persona.js` 单一推导） |
| spawn 补初始盘缠 | ✅ 已实现 | 同上（按身份 0.3~23 两） |
| spawn 补街坊关系 | ✅ 已实现 | 同上（同地点/同街坊随机一人，双向） |
| 营兵准入门槛（据城或受朝命） | ✅ 已实现 | `warfare.js#callToArms` |
| 欠饷 3 月哗变 + 洗劫反噬 | ✅ 已实现 | `warfare.js#runPayday`（30% 概率，粮≤50 石、银≤50 两） |

### 与方案的偏差（执行时做的调整）

1. **月饷不是统一 1 两**：按兵种分档——家丁 0.6、护院 0.9、营兵 1.5（依据明万历山东土兵 0.9 两、南兵 1.5 两）。
2. **中馈危机文案不写死名字**：方案里点名"婉儿"，实现改为遍历 `household` 眷属，文案统称"主母/内宅"，避免对某个角色特判。
3. **spawn 的街坊关系**：方案写"从同地点或街坊中挑一人"，实现为"同地点或同 home"，并双向写入。
4. **营兵门槛**额外接受"在任官职"作为替代（`world.court.offices` 中有本人），不只认城。
5. **哗变洗劫**有 30% 概率，不是必抢（避免每次欠饷都把玩家洗成白板）。

### 仍待补的（下一版）

- 中馈只到"发/欠/补"，还没有"具体采买了什么"的清单（柴炭米粮分项）。
- 营兵的"受朝命"目前只认 `court.offices`，未接"朝廷册封/武职"的完整体系。
- 哗变后没有"招抚溃兵"的补救路径。
