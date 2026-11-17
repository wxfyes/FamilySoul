#!/bin/sh
# 软路由开机自启安装与保活脚本 (OpenWrt / Linux 通用)
cd "$(dirname "$0")/.."
DIR="$(pwd)"

echo "[Autostart] 正在检查软路由自启动配置..."

# 1. /etc/rc.local 配置
if [ -f "/etc/rc.local" ]; then
    if ! grep -q "$DIR/start.sh" /etc/rc.local 2>/dev/null; then
        echo "[Autostart] 正在将 FamilySoul 加入 /etc/rc.local ..."
        if grep -q "exit 0" /etc/rc.local 2>/dev/null; then
            sed -i "/exit 0/i # FamilySoul AutoStart\n(sleep 12 && cd $DIR && ./start.sh) &\n" /etc/rc.local 2>/dev/null || true
        else
            echo -e "\n# FamilySoul AutoStart\n(sleep 12 && cd $DIR && ./start.sh) &\nexit 0" >> /etc/rc.local 2>/dev/null || true
        fi
        chmod +x /etc/rc.local 2>/dev/null || true
        echo "[Autostart] /etc/rc.local 配置完成！"
    else
        echo "[Autostart] /etc/rc.local 已包含自启动命令。"
    fi
fi

# 2. OpenWrt /etc/init.d/familysoul 服务
if [ -d "/etc/init.d" ] && [ -w "/etc/init.d" ]; then
    INIT_SCRIPT="/etc/init.d/familysoul"
    echo "[Autostart] 正在写入 $INIT_SCRIPT ..."
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
    /etc/init.d/familysoul enable 2>/dev/null || true
    echo "[Autostart] OpenWrt 系统服务已启用开机自启！"
fi

# 3. crontab 保活项（双重保险：若机器支持 crontab，每 5 分钟检测一次服务）
if command -v crontab >/dev/null 2>&1; then
    TMP_CRON="/tmp/crontab.$$"
    crontab -l 2>/dev/null > "$TMP_CRON" || true
    if ! grep -q "$DIR/start.sh" "$TMP_CRON" 2>/dev/null; then
        echo "*/5 * * * * if ! pidof node >/dev/null 2>&1; then (cd $DIR && ./start.sh); fi" >> "$TMP_CRON"
        crontab "$TMP_CRON" 2>/dev/null || true
        echo "[Autostart] 已添加 crontab 进程保活检测！"
    fi
    rm -f "$TMP_CRON" 2>/dev/null || true
fi

echo "[Autostart] 软路由自启动环境配置全部就绪！"
