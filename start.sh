#!/bin/sh
# SurfCore 伴侣服务端启动脚本 (免 Docker，原生极简后台运行)
cd "$(dirname "$0")"

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

# 确保数据目录存在
mkdir -p data/chat data/voice

echo "[*] 正在启动 SurfCore 小娘子服务端..."
nohup node src/server.js > "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

sleep 1
if kill -0 "$NEW_PID" 2>/dev/null; then
    echo "========================================================"
    echo "  🎉 启动成功！(PID: $NEW_PID)"
    echo "  服务端口: 3088"
    echo "  运行日志: $LOG_FILE"
    echo "  访问健康检查: http://127.0.0.1:3088/health"
    echo "========================================================"
else
    echo "[X] 启动失败，请检查日志："
    cat "$LOG_FILE"
fi
