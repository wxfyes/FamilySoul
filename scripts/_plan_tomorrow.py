import io
p = 'docs/WORLD_ALIVE_PLAN.md'
s = io.open(p, encoding='utf-8').read()
add = '''

---

## 明日开工清单（按顺序，做完一项勾一项）

### 上午 · P0 World Tick 骨架
```
□ 新模块 src/world/tick.js
    · advanceWorldTick(world)：每时辰一次，只推进规则，不写台词
□ 第一块只做四件：粮价、治安、雇工工钱、债
□ 挂到 clock：每个时辰调用一次（与现有巡检分开，别混在一起）
□ 单一写入口：所有变更走 money.js / moveActor / factionOf
□ 验收：regress 20/20 → 本地起服 → 线上观察 1 时辰，账对得上
```

### 下午 · P3 世界日报
```
□ GET /api/world/daily-report：今日各城的价、乱、事
□ 客户端「今日」看板加一栏：世界（只看得到的城）
□ 验收：一天的变化能在 App 里看懂，不靠聊天
```

### 之后 · P1 NPC 目标
```
□ 目标生成器：按身份/处境推"今天要办什么"
□ 目标要能被 tick 推进一步（成/败都要记账）
```

### 今晚你测聊天时，我会盯这几处
```
· 门房回话（白天叫门 → 应进中堂）
· 生人一律"客卿"的兜底是否还在
· 空场回复"（四下清静，一时无人接话。）"是否还出现
· 不在场的人是否还能开口
```
'''
if '明日开工清单' not in s:
    s = s.rstrip() + add
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已写入明日开工清单')
