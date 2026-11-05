# FamilySoul（宿命乾坤）· 全景系统架构白皮书

> **文档版本**：v2.0（全域沙盒自洽运行版）  
> **更新时间**：2026-11-05  
> **最高设计原则**：**代码算账，LLM只演戏；单一写入口；有病治根，彻底禁止打补丁**。

---

## 一、系统全景拓扑图（部署与通信架构）

```mermaid
flowchart TB
    subgraph Client["终端交互层 (Clients)"]
        Flutter["Flutter 移动端 (Android / iOS)<br/>• 3D立体头像 (Soul3DAvatarPainter)<br/>• 原生语音 (Apple Speech / Sherpa-ONNX)<br/>• 专属交互抽屉 (移动/找人/支付)"]
        WebDash["Web 生产看板 (dashboard.html)<br/>• 天下焦点速报<br/>• 120万两真体现银大账<br/>• 州府/县城/人物筛选"]
    end

    subgraph RouterProd["软路由生产主机 (192.168.1.254:3088)"]
        direction TB
        Server["HTTP 接入服务 (server.js)<br/>端口: 3088 | 原生免Docker架构"]
        
        subgraph Pipeline["业务与对话管道 (Orchestration)"]
            PetService["天道对话管道 (pet-service.js)<br/>提示词组装 • 事实压缩 • 意图代演"]
            Dispatch["标签解析与指令派发 (dispatch.js)<br/>单一入口强校验 • 杜绝空壳人物"]
        end

        subgraph CoreEngine["宿命乾坤·世界沙盒因果律底座 (src/world/)"]
            Clock["世界时钟中枢 (clock.js)<br/>360天岁时 • 月初放饷 • 中馈月例 • 匪患推演"]
            Position["空间唯一写入口 (position.js)<br/>moveActor • 真人角色拒绝代码位移"]
            Warfare["军事与天下推演 (warfare.js / strategy.js)<br/>月饷制 • 欠饷状态机 • 割据自立 • 城市易主"]
            Bandits["全国匪患生态 (bandits.js)<br/>17道灾荒民怨自然萌生 • 官民剿匪 • 团练使授衔"]
            Economy["明制经济与商道 (pricing.js / prices.js / trade.js)<br/>史料常价 • 按城分级 • 盐茶丝实体买卖"]
            Persona["世情人物推导 (persona.js / migration.js)<br/>性别/年龄/婚配/生理期单一推断 • 由事出人"]
            Realms["多重界域分层 (realm.js)<br/>凡尘(mortal) • 洞天福地(immortal) • 现代都市(modern)"]
        end

        subgraph Storage["数据资产与持久化 (data/)"]
            StateJSON[("当前世界快照<br/>data/world/state.json")]
            Milestones[("历史大事记既定账本<br/>data/world/milestones.json<br/>(510两运河大酒楼/林芸娘侧室)")]
            EventsJSONL[("天道事件流日志<br/>data/world/events.jsonl")]
        end
    end

    subgraph CloudAI["外部大模型与云端中枢"]
        DeepSeek["DeepSeek LLM (国内纯直连)<br/>纯文本剧情与角色台词演绎"]
        EdgeTTS["微软 Edge TTS (国内纯直连)<br/>高拟真角色流式语音合成"]
        Gemini["谷歌 Gemini (走本地专属代理)<br/>视觉看图与场景图生"]
    end

    Flutter -->|REST / SSE / Audio| Server
    WebDash -->|REST API| Server
    Server --> PetService
    PetService --> DeepSeek
    PetService --> EdgeTTS
    Server --> Dispatch
    Dispatch --> CoreEngine
    Clock --> CoreEngine
    CoreEngine --> StateJSON
    CoreEngine --> Milestones
    CoreEngine --> EventsJSONL
```

---

## 二、软件分层架构解析（从上至下）

```mermaid
graph TD
    classDef ui fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef gate fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef ai fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef sandbox fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#fff;
    classDef data fill:#451a03,stroke:#f59e0b,stroke-width:2px,color:#fff;

    subgraph L1["1. 表现与交互层 (Presentation Layer)"]
        U1["Flutter 跨平台客户端 (移动端)"]:::ui
        U2["Web 实时大屏看板 (管理员/PC端)"]:::ui
    end

    subgraph L2["2. 网关鉴权与权责分离层 (Gateway & Routing Layer)"]
        G1["通行令牌认证 (resolveMember)"]:::gate
        G2["权责分离核心：抽屉驱动物理动作，聊天驱动戏内台词"]:::gate
        G3["两段式异步并发保护 (杜绝大模型返回时的脏写覆盖)"]:::gate
    end

    subgraph L3["3. 天道编排与认知演进层 (AI Orchestration Layer)"]
        A1["事实压缩与 Prompt 装配 (summarize.js)"]:::ai
        A2["史料报价夹取安全网 (pricing.js#sanePrice)"]:::ai
        A3["天道意图指令解析器 (dispatch.js)"]:::ai
    end

    subgraph L4["4. 宿命乾坤·世界沙盒引擎层 (World Sandbox Engine Layer)"]
        S1["【空间与时序】clock.js (360日历法) / position.js (moveActor) / realm.js (三界分层)"]:::sandbox
        S2["【经济与产业】中馈月例银 (4两/月) / 盐茶丝实体贸易 (trade.js) / 物价指数 (prices.js)"]:::sandbox
        S3["【军事与战役】月饷制 (1两/兵/月) / 欠饷三档状态机 / 17道关隘接壤 (geography.js)"]:::sandbox
        S4["【匪患与治安】全国匪患生态 (bandits.js) / 官军与诸侯自治 / 乡勇剿匪获团练武职"]:::sandbox
        S5["【社会与人物】统一世情推断 (persona.js) / 由事出人入世 (migration.js) / 宗族清议 (clans.js)"]:::sandbox
    end

    subgraph L5["5. 状态持久化与自愈层 (Persistence & Self-Healing Layer)"]
        D1["单一真相源 state.json"]:::data
        D2["不可磨灭大事记 milestones.json"]:::data
        D3["自检巡检与开机自愈 heal.js / audit.js"]:::data
    end

    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
```

---

## 三、系统核心设计铁律与状态单一流向

| 核心领域 | 单一写入口函数 / 模块 | 核心规则与闭环保证 |
|---|---|---|
| **人物移动** | `src/world/position.js` ➔ `moveActor()` | • 真人角色（相公）世界代码移动一律拒绝，仅认客户端抽屉调用；<br/>• 杜绝“说回家就位移”等文字偷听；在押罪犯锁死牢狱。 |
| **城池产权** | `src/world/warfare.js` ➔ `changeCityOwner()` | • 城市归属变动唯一入口；旧主领地剔除、新主补入、驻军产权联动转移。 |
| **军事与兵饷** | `src/world/warfare.js` ➔ `runPayday()` / `callToArms()` | • 告别超市买断，招募走“一呼百应”付微量安家银；<br/>• 日常只按 0.02 石扣粮，每月初一统发月饷（1两/兵/月）；<br/>• 欠饷分级：1月怨声、2月逃兵当兵器、3月全营哗变并三成反噬洗劫府库。 |
| **小家中馈** | `src/world/clock.js` ➔ `runHouseholdPayday()` | • 天道每月初一从公中划拨 4 两白银给主母沈婉儿操持内宅；<br/>• 欠银触发典当危机（1月典钗贴补、2月炭火减半、3月内宅生计维艰）。 |
| **人物世情** | `src/world/persona.js` ➔ 三大 `infer` 函数 | • 性别、岁数、婚配按姓名与行当分类归纳推算，杜绝 `unknown`；<br/>• 生理周期严格限定在 14~49 岁，50岁以上归为长者绝经。 |
| **全国匪患** | `src/world/bandits.js` ➔ `runBanditEcosystem()` | • 全天下 17 道根据民怨（`unrest≥50`）、灾荒与地形自然涌现；<br/>• 官军自发剿匪；相公派护院剿匪保境安民，获缴获与知府团练使任命。 |
| **世界分层** | `src/world/realm.js` ➔ `buildRealm()` / `realmOf()` | • 凡尘（`mortal`）、洞天（`immortal`）、现代（`modern`）多界共存；<br/>• 人在何界由地点属性决定，通过门户（`gate`）跨界跃迁。 |

---

## 四、天道（LLM）与本地代码引擎的权责边界

```mermaid
sequenceDiagram
    autonumber
    actor User as 用户 (相公)
    participant Client as 客户端 (App / Web)
    participant Server as 本地服务 (Node.js)
    participant Engine as 沙盒引擎 (src/world/)
    participant LLM as DeepSeek 大模型

    Note over User,Client: 1. 物理动作驱动 (抽屉点选)
    User->>Client: 点击交互抽屉【前往运河码头大酒楼】
    Client->>Server: POST /api/world/go { place: 'canal_restaurant' }
    Server->>Engine: moveActor(world, 'husband', 'canal_restaurant', 'ui')
    Engine-->>Server: 成功更新位置至 canal_restaurant
    Server-->>Client: 200 OK (转场完成)

    Note over User,Client: 2. 戏内角色对话推进
    User->>Client: 语音输入："婉儿，今日酒楼开张筹备得如何了？"
    Client->>Server: POST /api/chat { text: "..." }
    Server->>Engine: summarize(world) 组装极简上下文事实 (所在/府中/明媒妻妾)
    Server->>LLM: 发送轻量 Prompt (DeepSeek 国内直连，零冗余账本)
    LLM-->>Server: 返回角色对话台词与自然神态
    Server-->>Client: 流式回传文本 + 微软 Edge TTS 高保真语音
```

> **边界原则总结**：
> - **引擎做算力与真理**：银两、粮食、兵数、城防、伤亡、物价、年龄、生理周期，**100% 由本地引擎毫秒级精确计算，0 Token 浪费**；
> - **天道做灵魂与对白**：大模型仅在需要推进剧情、沉浸对话、描写场景时登场，只负责“说合乎身份的漂亮人话”，绝不让大模型做算术题！

---

## 五、环境事实与生产规范

1. **主力生产主机**：
   - 软路由生产环境唯一确定为：**`/opt/familysoul`（监听端口 3088）**；
   - 严禁任何 AI 质疑软路由路径或建议拷贝至历史废弃的 `/opt/surfcore-server`；
2. **官方热更新发布指令**：
   ```bash
   node scripts/build-update.mjs && python scripts/self_update.py
   ```
3. **打包资产安全准则**：
   - `update.tar.gz` 必须包含 `data/world/milestones.json`（保障 510 两运河大酒楼等既定事实不沉没）；
   - 仅排除生产端自维持的运行时文件（`data/chat`、`data/world/state.json`、`data/world/events.jsonl`）。

