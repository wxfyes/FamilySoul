#!/bin/sh
cd "$(dirname "$0")"

PID_FILE="./server.pid"

if [ ! -f "$PID_FILE" ]; then
    # 兜底查找 node src/server.js 进程
    PIDS=$(pgrep -f "node src/server.js" || true)
    if [ -n "$PIDS" ]; then
        echo "[*] 正在停止相关进程: $PIDS"
        kill $PIDS
        echo "[OK] 已停止"
        exit 0
    fi
    echo "[!] 未发现正在运行的服务"
    exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
    echo "[*] 正在停止 SurfCore 服务 (PID: $PID)..."
    kill "$PID"
    sleep 1
    if kill -0 "$PID" 2>/dev/null; then
        kill -9 "$PID"
    fi
    echo "[OK] 服务已成功停止"
else
    echo "[!] 进程 (PID: $PID) 已经不存在"
fi

rm -f "$PID_FILE"
