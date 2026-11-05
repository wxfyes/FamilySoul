# 来客系统三个核漏洞 · 整改报告

> 来源：对 `docs/report-migrant-naming.md` 及其代码（`migration.js` / `server.js`）的穿透审查
> 结论：**三条全部成立，全部治本修复；已上线、回归 20/20**
> 未推 GitHub

---

## 一、逐条核对与修法

### 🔴 核问题 1：婚配一刀切，长者又被判未婚（成立）

**病灶（`migration.js:85` 原代码）：**

```js
marital: pm.cause === 'bride' ? 'married' : 'single',
```

**后果**：50 岁逃荒老妇、42 岁老脚夫全被判 `single`，前端显示「未婚 · 待字闺中」——
刚刚建立的世情婚配分层，在"来客"这条路上被完全绕过。

**修法（走单一入口）：**

```js
marital: inferMaritalStatus(nm, pm.role, Number(age) || Number(pm.age) || 25, gender),
```

**实测：**

```
55 岁「流落此地的老妇」→ widowed（寡居）✅
42 岁「脚夫」           → married（已婚）✅
```

---

### 🔴 核问题 2：天道起名撞名 → 活人被吞、卡死队列（成立）

**病灶（`migration.js:72` 原代码）：**

```js
if (Object.values(world.actors || {}).some((a) => a && a.name === nm)) return null;
```

**后果**：天道起大众名（李四、小翠、张生）撞上已有 NPC → 返回 null →
外层却已把 `pm.asked = true`，这个人既没生成，也不会再问天道，
在队列里挂满 3 天等兜底扫走。

**修法（撞名顺位补字，不能罢工）：**

```
李四 →（撞名）→ 李四郎 / 李四哥 / 李四生 / 李四二
女子 → 李四娘 / 李四氏 / 李四姐 / 李四姑
仍撞 → 用兜底名（百家姓+称谓）再试 10 次
实在取不出 → 才丢弃该条队列（避免无限挂起）
```

**实测：**

```
先落「张四」 → 再落同名「张四」 → 自动成为「张四郎」✅
```

---

### 🔴 核问题 3：心跳异步定名 = 脏写覆盖（成立，且最危险）

**病灶（原 `processMigrants`）：**

```js
const world = peek(DATA_DIR);        // 读一份
await llmClient.complete(...)        // 等 2~4 秒（这期间相公可能在出门/募兵/付款）
saveState(DATA_DIR, world);          // 把 3 秒前的旧世界整体写回
```

**后果**：这几秒内相公的任何操作（转场、募兵、买产业、付款）会被整体回滚。

**修法（两段式，await 期间绝不持有可写世界）：**

```
第一段（只读）：
  const snapshot = peek(DATA_DIR);
  取出 pendingMigrants 的 id 与资料（不在这份 world 上改了）

等待：
  await llm.complete(...) → 只拿到"名字/岁数/来历"这几个字段

第二段（重新读盘再合并）：
  const world = loadState(DATA_DIR);        // 拿最新世界（已含相公刚做的操作）
  按 id 找到对应来客 → materializeMigrant(world, pm, {...})
  从 pendingMigrants 移除已落的
  saveState(DATA_DIR, world);
```

**结果**：天道定名只做"增量合并"，不可能覆盖任何人在这几秒内的操作。

---

## 二、验证

| 项 | 结果 |
|---|---|
| `node --check migration.js` / `server.js` | 通过 |
| 回归 | **20/20** |
| 55 岁老妇婚配 | widowed ✅ |
| 42 岁脚夫婚配 | married ✅ |
| 撞名落人 | 张四 → 张四郎 ✅ |
| 旧 world 写盘 | 已移除（await 后重新 loadState） |
| 线上部署 | `/health` 正常 |

---

## 三、顺带说明的两件事

1. **修 `processMigrants` 时把函数末尾多写了一个右括号**，导致一次语法错误；
   已删掉并重新通过 `node --check` 与 20/20 回归——**这类低级错误我认。**
2. **`pendingMigrants` 现在最多保留最近 40 条**，即使极端情况下天道一直不给名字，
   也不会无限堆积（3 天后兜底落下或丢弃）。

---

## 四、仍然存在的风险（未在本轮修复，先记）

1. **天道定名是"一次问 3 人"**：如果天道返回的名字全撞名，会走顺位补字；
   补字后仍可能风格怪异（张四郎/张四哥），但至少不卡死。
2. **来客的 `background` 只是一句话**，没有接入"她跟谁有旧、住在哪条街、靠什么吃饭"。
3. **落脚三天后只是 `settled = true`**，没有真正分配住处/营生（该去绣坊、该进粥厂都没有）。
4. **并发还有一处类似风险**：`onAfterTick` 里"天下推演"也是 `peek → await LLM → save`，
   **与本次修的是同一个病**，建议下一轮按同样两段式改掉（我可以在下一轮直接做）。

---

## 五、提交记录（本地，未推送）

```
fix(migration): 婚配改走 inferMaritalStatus（不再手写 single）；
                撞名顺位补字（李四→李四郎），不再 return null 卡死队列；
                心跳定名改两段式：await 前只读、await 后重新 loadState 增量合并，
                杜绝旧 world 覆盖相公操作
```
