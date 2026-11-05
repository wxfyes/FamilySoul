import io, re
p = 'docs/COLLAB_BUS.md'
s = io.open(p, encoding='utf-8').read()
new_json = '''```json
{
  "status": "READY_FOR_REVIEW",
  "last_updated": "2026-11-05 23:05",
  "active_task": "房间改懒展开（地点表 1091→138）、冷启动 54ms、位置自愈日志降噪",
  "priority": "PERF_ARCHITECTURE",
  "changed_files": [
    "src/world/residence.js（materializeRoom / collapseRoomPlaces）",
    "src/world/places-target.js（按需展开）",
    "src/world/apply.js（按需展开）",
    "src/server.js（菜单列出账上的院子）",
    "src/world/state.js（巡检收拢 + 日志降噪）"
  ],
  "prod_metrics": {
    "places": 138,
    "cold_start_api_me": "54ms",
    "warm_api_me": "39~45ms",
    "warm_menu": "36~47ms",
    "chat": "2.6~3.7s"
  },
  "regression_tests": "20/20 PASSED",
  "reviewer_action": "请审查信箱"
}
```'''
s = re.sub(r'```json\n\{[\s\S]*?\}\n```', new_json, s, count=1)

report = '''

---

## ✅ 房间改懒展开（2026-11-05 23:05 · READY_FOR_REVIEW）

### 一、为什么要动结构

```
房间各占一个地点 → 地点表 1091 条 → 存档 1.5MB
每次请求解析、每次存盘序列化，全靠缓存顶着
重启第一次请求还要 1~2 秒（冷启动）
```

### 二、改法：房间只记账，人走进去才展开

```
父地点.places[宅].rooms = { garden: { id, name, use, depth, access } }
        ↓ 有人真走进去
materializeRoom(world, 父id, key) → 才创建 places['父id__garden']
        ↓ 人离开
collapseRoomPlaces(world) → 收回账上，删掉这个地点（只留有人待着的）
```

**一条规则覆盖四类空间**：宅院、酒楼、茶坊、衙署。
没有按城特判、没有按名字特判。

**配套三处**：

```
· 菜单：把"账上的院子"按 id 补进列表（不展开地点），点进去才展开
· 去哪：places-target 先找账上的房间，找到就展开
· 移动：apply 收到 "父id__key" 或 "宅名·院名"，先展开再走
```

### 三、实测（线上）

```
地点表        1091 → 138
已展开房间    1（就是刚才走进去的那间后花园）
冷启动 api/me 54ms（原来 1~2 秒）
热态 api/me   39~45ms
热态 menu     36~47ms
聊天          2.6~3.7s
```

**菜单里 20 个王宅院子照样列得出来**：

```
临江·王宅·朱漆大门 / 中堂大厅 / 临波后花园 / 大庖厨 / 后罩房 / 私兵值房 …
点"临波后花园" → {"ok":true,"place":"临江·王宅·临波后花园"} → 这时才多出一个地点
```

### 四、验证

| 项 | 结果 |
|---|---|
| `python scripts/regress.py` | **20/20** |
| 线下折叠测试 | 565 → 97 地点，王宅 20 院账目完好 |
| 线上折叠 | 1091 → 138，院房地点 0 |
| 线上展开 | 点后花园 → 地点 +1，名称正确 |
| 菜单 | 153 条（含 20 个王宅院子） |
| 聊天 | 2.6~3.7s，只在场者开口 |
| 客户端 | 无需重装 |

### 五、顺带

```
· [State] 位置自愈由"逐人刷屏"改成"一行汇总"
· 空间巡检里加了 collapseRoomPlaces（离开的房间自动收回）
```
'''
anchor = '## 📜 历史完成存档'
if '房间改懒展开' not in s:
    s = s.replace(anchor, report + '\n' + anchor, 1)
    print('bus 报告已写入')
io.open(p, 'w', encoding='utf-8').write(s)
