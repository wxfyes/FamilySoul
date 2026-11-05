# 任务一/二/三 交付报告：客户端闭环 · 市井呼应 · 架构提纯

> 依据：`docs/review-feedback-v2-and-next-actions.md`
> 状态：**三任务全部落地；服务端已上线；安卓包已重打**
> 回归：`python scripts/regress.py` → **20/20**；未推 GitHub

---

## 任务三（先做）：产业过滤抽成单一函数

**问题**：`/api/me` 与 `/api/world/menu` 各写一份过滤条件，条件相同、代码两份。

**修法**：

```js
// src/world/employment.js
export function visiblePropertiesOf(world, actorId) {
  const props = world?.assets?.properties || [];
  const id = actorId || 'husband';
  return props.filter((p) => {
    if (!p) return false;
    if (id === 'husband') {
      return p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper);
    }
    return p.owner === id || p.keeper === id;
  });
}
```

**两处调用：**

```
server.js:31   import { hireStaff, visiblePropertiesOf }
server.js:898  menu 的 homes  → visiblePropertiesOf(world, actorId)
server.js:1425 /api/me 的 props → visiblePropertiesOf(world, actorId || 'husband')
```

**实测**：相公的 `/api/me` 只回自家四处（王宅、茶坊、酒楼、生药铺），新号为空。

---

## 任务二：市井呼应

### ① 苦主求庇（引擎给事实，天道写台词）

```js
// pet-service.js：有 2 阶以上匪患时，注入一条事实
（【匪患实况】紫阳山黑风寨（临江府，60 人，2 阶）、太湖水盗（临江府，40 人，1 阶）。
  若相公在城中，可安排客商或百姓来诉苦求庇；台词照实情写，别编额外的匪。）
```

**于是天道会自己写出"茶车被扣、伙计被打、差役不敢出城"这类话，而不是我写死一句台词。**

### ② 聊天里点兵出征

```
相公说：「点齐三十名护院，随我去平了紫阳山黑风寨！」
天道输出：[[quell:黑风寨|30]]
引擎：按名字找匪 → 从你驻军最多的城调兵 → 真打 → 结果写回正文
     （大获全胜：剿平「黑风寨」，缴银 X 两、粮 Y 石，民心大振，知府感念忠勇，
       授「临江府乡勇团练使」）
```

**提示词里加了【出征规矩】：让天道只写标签，由引擎真打，再把战报写成台词。**

---

## 任务一：客户端三个面板

### ① 家兵面板 → 周边匪患 + 出征

```
列表：🔥 紫阳山黑风寨｜临江府 · 兵力 60 · 2 阶    [出征]
点「出征」→ 底部弹层选人数（10 / 20 / 50 / 100）→「点齐人马，出兵」
→ POST /api/world/military { action:'quell_bandits' }
→ 弹窗战报：「大获全胜 / 出师不利」+ 缴获与封赏文字
```

### ② 我的世界 → 中馈月例 + 一键补发

```
家底卡新增两行：
  中馈月例   4.0 两/月
  中馈欠拨 2 月，共 8.0 两    [补发中馈]
点按钮 → POST /api/world/household { action:'pay_arrears' }
```

### ③ 出门抽屉 → 商货行栈

```
「去哪儿」页顶部新增胶囊入口：[🏪 商货行栈]
点开：盐 / 茶 / 丝 / 铁 / 药材 五行
  每行：品名 · 市价 · 库存   [买 10] [卖 10]
→ POST /api/world/trade { action:'buy'|'sell', good, qty, city }
```

---

## 验证

| 项 | 结果 |
|---|---|
| 回归 | **20/20** |
| `flutter analyze` | 0 问题 |
| `/api/me` 字段 | household ✅ bandits ✅ goods ✅ |
| 产业过滤（相公/新号） | 四处 / 空 ✅ |
| 线上 `/health` | 正常 |
| 安卓包 | 已重打并覆盖桌面 |

---

## 未做 / 说明

1. **iOS 包**：按你之前的要求不推 GitHub，所以云端打包没触发，桌面 IPA 仍是旧版。
2. **看板（Web）**：本次只做了移动端三个面板；看板的匪患/中馈/商货尚未挂（数据都在 `/api/admin/world` 与 `/api/me` 里）。
3. **出征按钮**只列前 4 股匪，避免面板过长。
4. **聊天出征**依赖天道写出 `[[quell:名|人数]]`；若它没写，你也可以在面板上直接点。

---

## 提交记录（本地，未推送）

```
refactor(employment): visiblePropertiesOf 单一出处，menu 与 /api/me 共用
feat(bandits): 匪患实况注入（苦主求庇的由头）+ 聊天 [[quell:名|人数]] 真出征并回战报
feat(app): 家兵面板加周边匪患与出征；我的世界加中馈月例与补发；出门抽屉加商货行栈
```
