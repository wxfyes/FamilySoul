# 并发脏写治理 · 综合报告

> 起因：审查指出"心跳异步调 LLM 期间持有旧 world 存盘，会把相公的操作回滚"
> 范围：来客定名（已修）+ 天下推演（本轮修）+ 其余同类生成器（本轮只审不改，附方案）
> 状态：**已上线、回归 20/20、未推 GitHub**

---

## 一、这个病是什么

```
读盘（peek） → await 大模型（2~4 秒）→ 整份 saveState 写回
```

**在 await 的那几秒里，玩家完全可能：**

- 转场出门（moveActor 改了 location）
- 募兵/买粮/付款（改了 assets.silver、factions）
- 买产业、开房、确认订单（改了 pendingAction、properties）

**等待结束，旧 world 整份覆盖 → 上面这些操作全部回滚。**
钱花了没生效、兵招了没到账、人走了又回去——**这是最伤玩家信任的一类 bug。**

---

## 二、已修的两处

### ① 来客定名（上一轮已修）

```
第一段：peek 只读出待定名来客的 id 与资料（不在这份 world 上改）
等待：await LLM，只拿 name/age/background
第二段：loadState 取最新世界 → 按 id 增量落地 → saveState
```

### ② 天下推演（本轮修）

**旧代码：**

```js
const w0 = peek(DATA_DIR);
...
const out = await petService.llmClient.complete(...)   // 等 2~4 秒
applyStrategyDecisions(w0, decisions)                   // 改的是旧世界
saveState(DATA_DIR, w0);                                // 整份写回 → 回滚玩家操作
```

**新代码（两段式）：**

```js
// 第一段：只读，构造推演材料
const snap = peek(DATA_DIR);
if (今天该推演) {
  let decisions = null;
  if (有天道) {
    const promptWorld = peek(DATA_DIR);
    ensureFactions(promptWorld);
    decisions = await 问天道(...);        // 只拿决策，不持可写世界
  }

  // 第二段：重新读盘（已含这几秒内玩家的一切操作）
  const world = loadState(DATA_DIR);
  if (世界日没变 && 今天还没推演过) {
    applyStrategyDecisions(world, decisions);
    world.flags.lastStrategyDay = day0;
    saveState(DATA_DIR, world);
  }
}
```

**两个额外保护：**

```
① 若 await 期间世界已经跨日（dayNow !== day0）→ 这轮决策作废，不写
② 若 await 期间已有别的进程推演过（lastStrategyDay === day0）→ 不重复写
```

---

## 三、同类问题：另外 7 个生成器（已审，未改）

我逐个查过 `onAfterTick` 里的生成器，**它们都是同一个病**：

| 函数 | 是否 `await` | 是否 `await` 后整份 `saveState` |
|---|---|---|
| `fillProactiveTexts` | 是 | **是** |
| `resolveMemorials` | 是 | **是** |
| `generateCase` | 是 | **是** |
| `judgeCases` | 是 | **是** |
| `generateCityShops` | 是 | **是** |
| `generateDecree` | 是 | **是** |
| `generateNpcArcs` | 是 | **是** |

**为什么本轮没一起改：**

我试图加一个通用的 `saveDelta(before, after)`（只回写本次真正改过的字段），
结果第一次改把 `fillProactiveTexts` 后面的函数整段吞进去，**导致语法通过但作用域错乱**，
已回滚。**这种批量机械改法风险太高，我不拿你的线上环境赌。**

**正确的做法（建议下一轮单独做）：**

```
对每个生成器：
  1. await 前：const before = JSON.parse(JSON.stringify(world))
  2. await 后：const fresh = loadState(DATA_DIR)
     仅把"本函数改动过的顶层字段"从 world 合并进 fresh
  3. saveState(fresh)
逐个改、逐个跑回归、逐个上线——一次一个，不和别的改动混在一起
```

---

## 四、验证

| 项 | 结果 |
|---|---|
| `node --check src/server.js` | 通过 |
| 回归 | **20/20** |
| 本地起服 `/health` | 正常 |
| 线上热更新 + `/health` | 正常 |
| 推演两段式的两个保护 | 跨日作废 / 已推演不重写 |

---

## 五、诚实说明（这轮我犯的错）

1. **第一次批量替换把 7 个函数改坏了**（语法能过，但作用域错乱），
   我 `git checkout` 回滚后才重做——**线上没有受影响，但这属于我操作不谨慎。**
2. 因此**这轮只改了天下推演一处**，其余 7 处留作下一轮单独处理，
   并在本报告里写明方案与顺序，不夹带。

---

## 六、提交记录（本地，未推送）

```
fix(strategy): 天下推演改两段式——await LLM 前只读，回来重新 loadState 再增量合并，
               杜绝旧 world 覆盖玩家操作（跨日作废、已推演不重写）
```
