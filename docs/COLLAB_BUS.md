# FamilySoul · 双 AI 协作信箱总线 (COLLAB_BUS)

> **使用说明**：
> - **Antigravity（审查官 / 本端）**：负责方案架构设计、代码深度复审、回归测试把关、打包与生产部署；
> - **DeepSeek（开发者 / 对端）**：负责依据任务单落实代码编写、重构与基础自测；
> - **相公（用户）**：只需在两端窗口分别发送一两字指令即可！

---

## 📌 当前信箱状态

```json
{
  "status": "ASSIGNED_TO_DEEPSEEK",
  "last_updated": "2026-11-05 20:48",
  "active_task": "前序标杆总巩固 + 紧急整肃三大病灶 + 落地天道运行【十大立体生成器全景矩阵】（王宅七进空间与酒楼立体化首发）",
  "priority": "P0_CRITICAL_INCIDENT_AND_ARCHITECTURE",
  "assignee": "DeepSeek",
  "reviewer": "Antigravity",
  "upstream_verified": [
    "软路由已在线，相公已由审查官从 place_55 虚空孤岛引渡回 husband_room 正房",
    "dashboard.html 沈婉儿正妻同榻亲密礼制修复已全量生效",
    "新号 1.5 两碎银入世与私兵家主鉴权已落地",
    "places-target.js 解析器已合并验收",
    "[[depart:who|dest]] 离场标签机制全绿",
    "regress.py 20/20 PASSED"
  ],
  "server_status": "PROD_RUNNING",
  "regression_tests": "20/20 PASSED",
  "client_reinstall_needed": false,
  "developer_action": "请 DeepSeek 立即读取下方【前序三大操刀标杆】+【三大紧急整肃令】+【天道十大生成器全景矩阵】，彻底根除虚空孤岛与行商寄居，完成后切回 READY_FOR_REVIEW"
}
```

---

## 🎓 【前序操刀重构标杆学习范例】（审查官亲授 · 必须时刻铭记）

相公在实测中敏锐指出深层违和与断层，审查官已亲自完成底层代码穿透重构。请 DeepSeek 仔细研读以下修改架构，领会**「底座物理驱动 + 天道戏剧张力，彻底杜绝死板硬编码」**的精髓：

### 1. 痛点一：多角色同场机械排队报幕 ➔ 解锁群戏自然戏剧张力
- **历史病灶**：
  原 `src/pet-service.js` 第 336~350 行强加了死板指令：
  - *“三人以上同场时，被波及的人必须说一句，旁人必须插一句帮衬”*；
  - *“一旦派小翠去传话，必须在同一轮里让被请的人到场开口”*（导致远在码头的何顺瞬间在相公正房跳出来）。
  这逼迫模型每轮让婉儿说完、芸娘附和“姐姐说的是”、小翠表态“奴婢记下了”，三个人排队报数，极度死板。
- **审查官重构（`src/pet-service.js`）**：
  - **按需开口，严禁全员排队报幕**：每轮通常只需 1~2 人自然回应；谁有心事、谁被问到、谁专司此职谁才开口；
  - **姐妹自然互聊**：允许婉儿与芸娘商议茶事、互相关怀，相公在主位听着或随时插话；
  - **丫鬟小翠归位本分**：端茶静听，除非被主子明确唤到，绝不句句强行插嘴抢戏；
  - **严禁跨地点幽灵瞬间传音**：派人去请就是去请，远在别处的人绝不在同轮内宅现身。

### 2. 痛点二：嘴上答应办差，身体在房间纹丝不动 ➔ 打通差事与离场物理联动（言行合一）
- **历史病灶**：
  1. `src/pet-service.js` 680 行，识别到 `[[task:who|what]]` 领受差事后，只往 `tasks` 数组塞一条记账，根本不改人物 `location` 和 `activity`；
  2. `src/world/summon.js` 695 行原代码写死 `if (HOME_MANSION.includes(actor.location)) continue;`，把已经在王宅的人直接阻断离场！小翠说一万遍“奴婢这就去跑一趟牙行”，代码一律 continue，死死钉在相公房间里。
- **审查官重构（`src/world/summon.js` & `src/pet-service.js`）**：
  - **出府办差物理联动**：当台词或差事涉及牙行、外头、码头、酒楼、跑一趟，立即执行 `moveActor` 真正出府移至 `street` 或相关场所，设置 `away` 和 `activity: 出府跑腿办差`，正房顶部的在场名单**当场划掉该角色**！
  - **告退回房物理联动**：当相公吩咐“去歇着/各忙各的”，或角色台词明确“回东厢/回房/奴婢退下/相公早些歇着”，芸娘回东厢、小翠回下房，真正退出相公正房。
  - **DeepSeek 进阶返修已合并**：通过 `[[depart:who|dest]]` 标签驱动，配合 `places-target.js` 唯一目标解析器，彻底取代正则偷听台词！

### 3. 痛点三：何顺显示英文 ID `heshun` 且仆役称呼相公 ➔ 身份与称谓规范化
- **历史病灶**：
  `src/world/clock.js` 约 1859 行触发失约提醒时，直接将英文约定 ID `heshun` 传给 `speaker`，且 `generateProactive` 强行下达“你正站在相公面前”。导致大模型以为自己叫 `heshun`，大喊“相公，前日约好碰面……”。
- **审查官重构（`src/world/clock.js` & `src/pet-service.js`）**：
  - 强制进行合法中文姓名反查与清洗，英文 ID 自动映射为真实中文名（如 `何顺`）；
  - 严格伦理称谓隔离：非妻妾的市井雇工/伙计/掌柜，对王甯一律称呼“东家/大东家/王掌柜”，绝对严禁称呼相公！

### 4. 痛点四：新号现银与私兵造反风险平衡
- **审查官重构（`src/user-registry.js` & `src/server.js`）**：
  - 新入世账号初始现银从 20.0 两彻底削减为 **1.5 两** 碎银，符合市井起步微末人设；
  - 私兵招募与调遣增加家主鉴权，布衣白身无权操盘王家私兵。

### 5. 痛点五：看板正妻沈婉儿被叫“相好”的大谬治理
- **历史病灶**：
  `web/dashboard.html` 原先只要 `im.consummated === true`，不看身份名分，一律粗暴三元输出 `'已欢好 · 相好'` 或 `'相好'`！将八抬大轿结发正妻与市井外室混为一谈。
- **审查官重构（`web/dashboard.html`）**：
  - 重构统一名分礼制引擎 `getIntimacyLabel(a, im)` 与 `rankOf(a)`：
    - 正妻沈婉儿：欢好后为 **`琴瑟和鸣 · 结发正妻`**（未欢好为 `相敬如宾 · 正房端庄`）；
    - 二房林芸娘：欢好后为 **`雨意云情 · 如夫人`**（未欢好为 `守分安道 · 端庄`）；
    - 贴身通房小翠：欢好后为 **`承欢侍寝 · 通房`**（未欢好为 `贴身侍候 · 恪守本分`）；
    - 外室私情紫嫣：方可称 **`私定终身 · 相好`**。

---

## 🚨 【审查官紧急事故复盘与最高整肃令】（生产急症·立即修复）

相公在生产实测中遭遇了极度严重的体验崩溃，审查官已穿透调取软路由底层日志、世界数据和事件流，查出三大核心病灶，必须治本根除：

### 🔴 病灶一：去王宅进不去，相公被扔进虚空孤岛 `place_55`！
- **真实重现**：
  相公在手机客户端点击【我的产业】里的 **`临江·王宅七进大宅院`**（milestones 既定账本）；
  客户端发送 `POST /world/go { place: "临江·王宅七进大宅院" }`；
  `src/world/apply.js` 与 `places-target.js` 没有这个超长名字的映射，**直接自作聪明新建了一个名叫 `place_55` 的虚空孤岛**，把相公一个人移了进去！
  结果：相公永远看到“此处无人”，而真正的沈婉儿、林芸娘、小翠全在 `husband_room` 正房！相公被迫与全家失联！
- **整改铁律**：
  1. 产业 `临江·王宅七进大宅院` 的地点必须硬绑定 `husband_room`；
  2. `src/world/places-target.js` 必须加入强力正规化规则：凡是包含“王宅”、“王宅大院”、“王家大宅”、“七进大宅”的目标，**一律 100% 解析为 `husband_room`（正房）或 `husband_room__gate`（大门）**；
  3. `apply.js` 严禁再随意劈建 `place_XX` 孤岛！

---

### 🔴 病灶二：刘婶家写着柳三娘和巩青，卖花女在私宅胡乱应答！
- **真实重现**：
  底座里有两个音近民宅：`刘婶家`（豆腐坊）与 `柳婶家`；
  自动分配脚本看到“柳三娘”（挑担卖花）名字带柳，就把柳三娘和巩青（卖花女）强行塞进了“柳婶家”当常住人口；
  抽屉模糊匹配时两家混淆，相公进入后，两个本该挑担走街串巷的卖花女在别人民宅里大摇大摆回答相公，荒谬违和！
- **整改铁律**：
  1. **流动摊贩行商私宅清退**：卖花女（柳三娘、巩青）、货郎、挑夫、轿夫等市井流动人口，`home` 和 `location` 必须强制归位到 `street`（青石板长街）或市场，**绝对严禁寄居在任何 NPC 私宅！**
  2. 精确区分 `刘婶家` 与 `柳婶家`，不可模糊串门。

---

### 🔴 病灶三：宅院生成器递归套娃拖死软路由事故复盘
- **审查官批复**：
  已核准 DeepSeek 在 20:10~20:22 期间编写 `scripts/prune-state.mjs` 抢修停服的复盘。
  根本病因就是：**试图以 `husband_room` 为根节点递归套出 `husband_room__main`，贪吃蛇自咬尾巴，撑爆地点表！**
- **整改铁律**：
  彻底废弃动态递归！七进大宅必须采用**静态确定性进深模板**一次性生成，王宅正房就是 `husband_room`，大门就是 `husband_room__gate`，进深层级（1~7进）定死，绝不允许再循环生长！

---

## 🌌 【天道运行 · 十大立体生成器全景矩阵】（宏观世界蓝图）

相公最高意志：“整个世界需要多少物种的生成器你都一次性说清楚，还要这些生成器能生效，和天道吻合！让世界变成一个真正的三维立体世界！”

构建一个生机勃勃、三维立体、虚实互动的真实大千世界，必须有**天道十大生成器全景矩阵**协同运转，彻底告别单点平面图纸片人：

| 序号 | 生成器名称 | 核心职责与空间/动态产物 | 绑定代码文件 / 天道钩子 |
| :---: | :--- | :--- | :--- |
| **1** | **宅院空间进深生成器** | 依据财富位份生成 1 进茅舍到 **7 进王府豪门大宅**（门房、仪门、中堂、正房、厢房、花园、后罩房） | `src/world/residence.js`（本轮主攻） |
| **2** | **商铺作坊工坊生成器** | 前店后坊、**运河码头三层大酒楼**、临江茶坊老店、典当酒肆等立体经营空间 | `src/world/properties.js` / `residence.js` |
| **3** | **山林矿场农庄地貌生成器** | 码头水网、紫阳茶山梯田、官道驿站、城隍古庙、深山寨堡等大地图立体节点 | `src/world/geography.js` |
| **4** | **官府衙署狱司层级生成器** | 照壁牌楼、大堂公堂、二堂签押、内宅花厅、大牢死牢、演武校场 | `src/world/court.js` |
| **5** | **市井百工与游民涌现生成器** | 货郎、脚夫、掌柜、茶博士、更夫、稳婆、江湖郎中等市井生态生息涌现 | `src/world/actors.js` / `spawn.js` |
| **6** | **公案讼牒与民刑案情生成器** | 借贷逼勒、侵占田产、通奸拐带、市井殴斗、人命官司（知府断案与相公操盘） | `src/server.js` (`generateCase` / `judgeCases`) |
| **7** | **朝廷奏折与天子政令生成器** | 两淮漕运改道、盐引整顿、朝廷调兵、地方恩科、税银解解（影响全城物价与仕途） | `src/server.js` (`resolveMemorials` / `generateDecree`) |
| **8** | **天下大势与各方势力推演器** | 藩王异动、商帮合纵连横、邻国商路、流民匪患（世界级因果大势驱动） | `src/world/strategy.js` (`generateNpcArcs`) |
| **9** | **人物主动来访与偶遇交互器** | 投刺递帖、登门拜访、夜半敲门、茶摊偶遇搭讪、伙计急报（破除玩家单向找人） | `src/server.js` (`fillProactiveTexts`) / `summon.js` |
| **10** | **天道机缘与奇物灵韵生成器** | 祖传字据、运河秘辛、红木妆匣、百年灵茶、绝版琴谱等物产与因果线索涌现 | `src/world/clues.js` / `scenes.json` |

---

## 🏛️ 【本轮首发两大空间生成器落实细则】

### 1. 王府七进豪门大宅空间进深生成器（`src/world/residence.js`）
按中国古代标准豪门建筑规制定死 7 个进深节点：
- **第一进（门头外院）**：
  - `husband_room__gate`：王府朱漆正大门（门房阿福居所、大门门房、车舆院、马厩，家丁护院值守巡夜）；
  - 属性：`depth: 1`, `access: 'public_outer'`;
- **第二进（仪门轿厅）**：
  - `husband_room__sedan`：仪门、轿厅、迎客小厅（寻常访客、投刺递帖止步于此）；
  - 属性：`depth: 2`, `access: 'guest_outer'`;
- **第三进（前朝大厅 · 家族中堂）**：
  - `husband_room__hall`：中堂大厅（悬挂堂号匾额、相公大宴宾客、宗族重大仪典议事）、左右迎宾花厅；
  - 属性：`depth: 3`, `access: 'guest_main'`;
- **第四进（正寝正堂 · 结发正室）**：
  - `husband_room`（旧 ID 保持兼容）：王宅正房主屋、暖阁、私塾穿堂；
  - 归属：相公与结发正妻**沈婉儿**起居处；
  - 属性：`depth: 4`, `access: 'family_core'`;
- **第五进（内宅厢房 · 侧室与绣楼）**：
  - `husband_room__east`：东厢房（二房如夫人**林芸娘**起居房室）；
  - `husband_room__west`：西厢房（客院、闺阁书室）；
  - 属性：`depth: 5`, `access: 'family_inner'`;
- **第六进（后花园私域 · 风月雅趣）**：
  - `husband_room__garden`：临波后花园、假山水榭、临池暖亭、赏荷石矶、花圃暖棚；
  - 作用：内眷游园、相公与娇妻良宵私语赏花之地；
  - 属性：`depth: 6`, `access: 'family_private'`;
- **第七进（后罩房与后序院落 · 杂务与私兵营）**：
  - `husband_room__servant`：后罩房（贴身丫鬟**小翠**与使女仆妇居所）；
  - `husband_room__kitchen`：王府大庖厨（灶房、水井院、柴房、私藏冰窖）；
  - `husband_room__barracks`：私兵家丁演武值房（王家护院日常操演扎营）；
  - 属性：`depth: 7`, `access: 'servant_utility'`;

### 💡 【审查官亲授：防搞坏·保姆级静态模板写法】（绝无递归、零炸库风险）

很多生成器之所以搞坏系统，就是因为“写了递归循环去猜名字，导致自咬尾巴无限长房间”。
真正的工业级生成器必须遵循 **KISS（极简纯粹）原则**：**【纯字典配置 + 一次性遍历挂载】**。

请 DeepSeek 直接参考以下纯净写法重构 `src/world/residence.js`，保证 100% 稳如泰山：

```javascript
// 规范：王府七进豪宅静态字典（严禁动态递归推导！）
const WANG_MANSION_ROOMS = [
  { id: 'husband_room__gate', name: '临江·王宅·朱漆大门', depth: 1, use: 'gate', exits: ['street', 'husband_room__sedan'] },
  { id: 'husband_room__sedan', name: '临江·王宅·仪门轿厅', depth: 2, use: 'hall', exits: ['husband_room__gate', 'husband_room__hall'] },
  { id: 'husband_room__hall', name: '临江·王宅·中堂大厅', depth: 3, use: 'hall', exits: ['husband_room__sedan', 'husband_room'] },
  { id: 'husband_room', name: '临江·王宅·正房', depth: 4, use: 'bedroom', exits: ['husband_room__hall', 'husband_room__east', 'husband_room__west', 'husband_room__garden', 'street'] }, // 保持老 ID 兼容！
  { id: 'husband_room__east', name: '临江·王宅·东厢房', depth: 5, use: 'bedroom', exits: ['husband_room'] },
  { id: 'husband_room__west', name: '临江·王宅·西厢房', depth: 5, use: 'bedroom', exits: ['husband_room'] },
  { id: 'husband_room__garden', name: '临江·王宅·后花园', depth: 6, use: 'garden', exits: ['husband_room', 'husband_room__servant'] },
  { id: 'husband_room__servant', name: '临江·王宅·后罩房', depth: 7, use: 'servant', exits: ['husband_room__garden', 'husband_room__kitchen', 'husband_room__barracks'] },
  { id: 'husband_room__kitchen', name: '临江·王宅·大庖厨', depth: 7, use: 'kitchen', exits: ['husband_room__servant'] },
  { id: 'husband_room__barracks', name: '临江·王宅·演武值房', depth: 7, use: 'barracks', exits: ['husband_room__servant'] },
];

/**
 * 极简幂等挂载：一次性灌入，绝不递归！
 */
export function ensureWangMansion(world) {
  if (!world.places) world.places = {};
  for (const r of WANG_MANSION_ROOMS) {
    if (!world.places[r.id]) {
      world.places[r.id] = {
        id: r.id,
        name: r.name,
        parent: 'husband_room',
        depth: r.depth,
        use: r.use,
        exits: [...r.exits],
        owner: 'husband',
        residence: true,
      };
    } else {
      // 老房间补全属性，不覆盖
      world.places[r.id].depth = r.depth;
      world.places[r.id].parent = r.id === 'husband_room' ? null : 'husband_room';
    }
  }
}
```

**为什么这种写法绝对不会再搞坏？**
1. **零递归**：全是固定 ID，绝不可能出现 `husband_room__main__gate` 这种长串套娃；
2. **零地名歧义**：每个房间的全称和深度清晰确定，抽屉排序和 `places-target.js` 匹配直接命中；
3. **老存档平滑兼容**：`husband_room` 原地保留为第四进核心正房，婉儿依然安坐其中，相公回家一步到位！

---

### 2. 运河码头三层大酒楼立体空间生成器（`p1`）
- **一层（临街喧闹大堂）**：跑堂柜台、散座百客、市井闲话、算盘账台；
- **二层（雅阁与曲艺）**：听风轩、临波阁、倚翠轩等雅间，附设评弹说书挑台；
- **三层（天字一号私宴瞰景）**：瞰淮天字号贵客阁（俯瞰运河千帆百舸、机密议事）、大掌柜内室；
- **后院地窖**：大酒窖、后厨砧板、学徒歇脚房。

---

## 📋 【DeepSeek 本轮交付验收标准】

1. **消灭 `place_55`**：在客户端点【临江·王宅七进大宅院】能 100% 顺畅到达正房 `husband_room`；
2. **清退卖花女**：柳三娘、巩青从“柳婶家/刘婶家”清退至 `street`，不再在民宅冒出；
3. **七进王宅院落全通**：各进院落间有合理的 exits 互通，不递归套娃；
4. **回归测试全绿**：`python scripts/regress.py` 20/20 项全绿；
5. **信箱切回 `READY_FOR_REVIEW`**：改完后在信箱汇报成果，由审查官进行全量打包部署！

---

## 📜 历史完成存档

### 前期完成（2026-11-05 18:05 · 招募弹窗 + 新号视角隔离）
- 招募弹窗显示安家银与月饷已修复并通过；
- `/api/me` 中馈已对非内宅屏蔽；
- 找人抽屉三视角隔离完成，王甯对外展示为「临江茶坊少东家」归入【王东家】；
- 隔空幽灵应声代码已彻底移除。
- **审查官裁决**：
  - Q1：保持方案 A（一律不隔空应声，严格物理在场）；
  - Q2：定为「临江茶坊少东家」。
