# 来信 / 回话 / 求见：服务端契约（客户端按此接）

## 铁律

1. **主聊天只留在场的人**；不在场的人递话，进独立收件箱，绝不直接塞主聊天；
2. **私密处求见默认门外候着**；相公点「见」才 `action=allow`，服务端才 `moveActor` 进来；
3. 第三人以上时，收件箱只出角标，不弹窗、不语音、不自动滚动；
4. 回信必须相公点，AI 不代回；回信内容只进 thread，不进主聊天；
5. 所有 thread/message 落盘在 `world.correspondence`，更新包不覆盖。

## 主动事件新增字段（`/dsh-surfcore/pet-api/events`）

```json
{
  "type": "proactive",
  "text": "【门房】：……",
  "speaker": "门房",
  "source": "回话·门房",
  "kind": "letter | report | visit",
  "privacy": "private | public",
  "threadId": "corr_12",
  "requiresConsent": true,
  "status": "pending"
}
```

- `kind=letter`：来信，可回信；
- `kind=report`：回话/禀报，可回话；
- `kind=visit`：求见，私密处只到门外；`requiresConsent=true`。

## API

### 1. 收件箱

`GET /dsh-surfcore/pet-api/correspondence?token=...`

```json
{ "ok": true, "unread": 2, "threads": [
  { "id": "corr_12", "fromName": "翟管事", "kind": "letter", "source": "来信",
    "status": "pending", "unread": true, "requiresConsent": false,
    "placeName": "翟家货栈", "day": 21, "hour": 8,
    "last": { "role": "them", "text": "……" } }
] }
```

### 2. 打开一封

`GET /dsh-surfcore/pet-api/correspondence/thread?id=corr_12&token=...`

返回完整 `thread`，并把 `unread=false`。

### 3. 回信（独立通道）

`POST /dsh-surfcore/pet-api/correspondence/reply`

```json
{ "id": "corr_12", "text": "知道了，按计划办。" }
```

只追加到 thread，**不触发主场景回复、不进主聊天**。返回更新后的 thread。

### 4. 处理求见 / 稍后 / 不回

`POST /dsh-surfcore/pet-api/correspondence/action`

```json
{ "id": "corr_12", "action": "allow | wait | decline | read" }
```

- `allow`：只对 `kind=visit`；先校验真人角色（真人由本人决定，服务端拒绝代进）；
  通过后 `moveActor` 到相公所在地，`status=approved`；
- `wait`：`status=waiting`，人仍在门外；
- `decline`：`status=declined`，人走；
- `read`：只标已读。

## 客户端 UI 规则

- 每条主动消息底部：
  - `letter`：`回信` / `稍后`
  - `report`：`回话` / `稍后`
  - `visit`：`见` / `回信` / `稍后`
- 点「回信/回话」→ 打开独立 thread 页，顶部标 `来源：`，输入框只属于这封信；
  发送后返回主聊天，主聊天其他人的上下文不被写入；
- 私密处求见：主聊天只显示一行 `【门房】某在门外候着`，**不把 actor 加进「此处」**；
  点「见」才 allow，服务端移动后主聊天刷新 `此处`；
- 三人以上：只更新收件箱角标，主聊天不插入、不滚屏、不播语音；
- 每条消息显示 `source`（如「来源：门房」「来源：差事回话·陈二」），不要再出现无署名红框。
