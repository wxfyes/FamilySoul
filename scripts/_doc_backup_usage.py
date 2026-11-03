import io
p = 'docs/cost-optimization.md'
s = io.open(p, encoding='utf-8').read()

add = '''

---

# 附二：备份脚本用法（`scripts/backup.mjs`）

## 一、它绝对安全

```
① 只读 data/，绝不写 data/
② 不删任何东西，除非你加 --prune
③ 默认 dry-run：先告诉你"会删什么"，不真删
④ 备份失败不影响正在跑的服务
```

**它只做两件事：把 data 压成 .gz 放进 backups/；按保留策略清理 backups/ 里的旧份。**

## 二、四条命令

```bash
# ① 只备份（最常用，可挂定时任务）
node scripts/backup.mjs

# ② 备份 + 清理过期备份
node scripts/backup.mjs --prune

# ③ 备份 + 清理备份 + 删除 7 天前的语音
node scripts/backup.mjs --prune --prune-audio 7

# ④ 校验最近一份备份是否完好
node scripts/backup.mjs --verify
```

**输出示例：**

```
✓ 备份完成：6 个文件 → backups/2026-11-03
  原始 136.2 KB → 压缩 25.2 KB
  · world/state.json  95.4 KB
· 没有过期备份需要清理
  日备份保留 14 天，周备份保留 8 份
```

## 三、保留策略

```
日备份：保留 14 天
周备份：每周日那份自动留 8 份（不受 14 天限制）
语音：--prune-audio 7 → 只留 7 天
```

**周备份是"防连续误删"的保险**：日备份全被覆盖，还能回到上周。

## 四、挂定时任务

### 软路由（cron）

```bash
# 每天 03:10 备份 + 清理
10 3 * * * cd /opt/familysoul && /usr/bin/node scripts/backup.mjs --prune --prune-audio 7 >> backups/backup.log 2>&1
```

### 或 systemd timer

```ini
# /etc/systemd/system/familysoul-backup.service
[Unit]
Description=FamilySoul backup

[Service]
Type=oneshot
WorkingDirectory=/opt/familysoul
ExecStart=/usr/bin/node scripts/backup.mjs --prune --prune-audio 7
```

```ini
# /etc/systemd/system/familysoul-backup.timer
[Unit]
Description=Daily FamilySoul backup

[Timer]
OnCalendar=*-*-* 03:10:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl enable --now familysoul-backup.timer
```

## 五、异地一份（可选，但建议）

```bash
# 每天把当日备份推去开发机
scp -r /opt/familysoul/backups/$(date +%F) root@192.168.1.112:/backup/familysoul/
```

**同一块硬盘上的备份，挡不住硬盘坏。**

## 六、恢复怎么做

```bash
# ① 停服务
cd /opt/familysoul && ./stop.sh

# ② 解压当天备份（覆盖前先自己留一份）
cp -r data data.bak-$(date +%s)
gzip -d -c backups/2026-11-03/world/state.json.gz > data/world/state.json
gzip -d -c backups/2026-11-03/world/milestones.json.gz > data/world/milestones.json

# ③ 起服务
./start.sh
```

**恢复后第一件事：跑 `node scripts/backup.mjs --verify`，确认新备份也能生成。**

## 七、三条纪律

```
① 恢复前一定先备份现状（data.bak-时间戳）
② 每月至少做一次 --verify
③ 每季度真恢复一次到临时目录试跑，别等出事才第一次用
```

**没演练过的备份，等于没有备份。**
'''

if '备份脚本用法' not in s:
    io.open(p, 'w', encoding='utf-8').write(s.rstrip() + add)
    print('appended backup usage')
else:
    print('exists')
