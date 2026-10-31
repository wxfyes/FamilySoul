#!/bin/sh
cd "$(dirname "$0")"

PID_FILE="./server.pid"
LOG_FILE="./server.log"

echo "========================================================"
echo "          SurfCore 伴侣服务运行状态检查                 "
echo "========================================================"

RUNNING=0
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        RUNNING=1
        echo "状态: [运行中] (PID: $PID)"
    fi
fi

if [ $RUNNING -eq 0 ]; then
    echo "状态: [未运行]"
    exit 0
fi

echo ""
echo "--- 进程资源占用 ---"
ps | grep "node src/server.js" | grep -v grep || true

echo ""
echo "--- 健康检查 (HTTP 3088) ---"
if which curl >/dev/null 2>&1; then
    curl -s http://127.0.0.1:3088/health || echo "请求无响应"
elif which wget >/dev/null 2>&1; then
    wget -qO- http://127.0.0.1:3088/health || echo "请求无响应"
fi

echo ""
echo "========================================================"
echo "查看实时日志: tail -f $LOG_FILE"
echo "停止服务命令: ./stop.sh"
echo "========================================================"
