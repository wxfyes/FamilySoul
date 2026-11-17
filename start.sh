#!/bin/sh
# FamilySoul 伴侣服务端启动脚本 (免 Docker，原生极简后台运行，自带开机自启安装器)
cd "$(dirname "$0")"
DIR="$(pwd)"

# 1. 补齐系统完整 PATH（防止软路由开机启动时 PATH 缺失找不到 node/wget 等基础命令）
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:$PATH"

# 2. 动态探测 node 绝对路径
NODE_BIN=$(command -v node 2>/dev/null)
if [ -z "$NODE_BIN" ]; then
    for p in /usr/bin/node /usr/local/bin/node /opt/bin/node /usr/bin/nodejs; do
        if [ -x "$p" ]; then
            NODE_BIN="$p"
            break
        fi
    done
fi
if [ -z "$NODE_BIN" ]; then
    NODE_BIN="node"
fi

PID_FILE="./server.pid"
LOG_FILE="./server.log"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "[!] 服务已经在运行中 (PID: $PID)"
        echo "查看日志: tail -f $LOG_FILE"
        exit 0
    fi
fi

# 确保必要目录存在
mkdir -p data/chat data/voice data/world

# 3. 🛡️ 软路由开机自启动自动安装与自愈机制 (Auto-Install Autostart)
install_autostart() {
    # 方式 A：OpenWrt / Linux 通用标准 /etc/rc.local
    if [ -f "/etc/rc.local" ]; then
        if ! grep -q "$DIR/start.sh" /etc/rc.local 2>/dev/null; then
            # 在 exit 0 前插入后台延迟启动指令（等待网络与挂载点就绪）
            if grep -q "exit 0" /etc/rc.local 2>/dev/null; then
                sed -i "/exit 0/i # FamilySoul AutoStart\n(sleep 12 && cd $DIR && ./start.sh) &\n" /etc/rc.local 2>/dev/null || true
            else
                echo -e "\n# FamilySoul AutoStart\n(sleep 12 && cd $DIR && ./start.sh) &\nexit 0" >> /etc/rc.local 2>/dev/null || true
            fi
            chmod +x /etc/rc.local 2>/dev/null || true
            echo "[*] 已成功注册软路由开机自启至 /etc/rc.local"
        fi
    fi

    # 方式 B：OpenWrt 标准 procd init.d 服务
    if [ -d "/etc/init.d" ] && [ -w "/etc/init.d" ]; then
        INIT_SCRIPT="/etc/init.d/familysoul"
        if [ ! -f "$INIT_SCRIPT" ]; then
            cat << 'EOF' > "$INIT_SCRIPT"
#!/bin/sh /etc/rc.common
START=99
STOP=10

start() {
    (sleep 12 && cd /opt/familysoul && ./start.sh) &
}

stop() {
    cd /opt/familysoul && ./stop.sh
}

restart() {
    stop
    sleep 2
    start
}
EOF
            chmod +x "$INIT_SCRIPT" 2>/dev/null || true
            if command -v /etc/init.d/familysoul >/dev/null 2>&1; then
                /etc/init.d/familysoul enable 2>/dev/null || true
                echo "[*] 已成功注册 OpenWrt 系统服务 /etc/init.d/familysoul 并启用自启"
            fi
        fi
    fi
}
install_autostart 2>/dev/null || true

echo "[*] 正在启动 FamilySoul 小娘子服务端..."
# 日志改为追加，并在启动时轮转（避免重启把证据冲掉）
if [ -f "$LOG_FILE" ]; then
    tail -n 800 "$LOG_FILE" > "$LOG_FILE.prev" 2>/dev/null || true
    SIZE=$(wc -c < "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 2000000 ]; then
        tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
fi

nohup "$NODE_BIN" src/server.js >> "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

sleep 1
if kill -0 "$NEW_PID" 2>/dev/null; then
    echo "========================================================"
    echo "  🎉 启动成功！(PID: $NEW_PID)"
    echo "  Node 路径: $NODE_BIN"
    echo "  服务端口: 3088"
    echo "  运行日志: $LOG_FILE"
    echo "  开机自启: 已自动守护并配置"
    echo "  访问健康检查: http://127.0.0.1:3088/health"
    echo "========================================================"
else
    echo "[X] 启动失败，请检查日志："
    cat "$LOG_FILE"
fi
