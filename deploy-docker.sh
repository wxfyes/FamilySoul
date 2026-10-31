#!/bin/sh
set -e

echo "========================================================"
echo "  Deploying SurfCore Companion Server on iStoreOS...    "
echo "========================================================"

# 1. 检查是否存在 config.json
if [ ! -f "config.json" ]; then
    echo "[!] 首次运行，复制 config.example.json -> config.json"
    cp config.example.json config.json
    echo "[!] 请用文本编辑器打开 config.json 并填写你的 DeepSeek API Key！"
fi

# 2. 构建本地轻量 Docker 镜像
echo "[*] 开始构建 Docker 镜像 (surfcore-server:latest)..."
docker build -t surfcore-server:latest .

# 3. 停止并清理旧容器
if docker ps -a | grep -q "surfcore-companion"; then
    echo "[*] 停止并移除已有容器..."
    docker stop surfcore-companion >/dev/null 2>&1 || true
    docker rm surfcore-companion >/dev/null 2>&1 || true
fi

# 4. 启动新容器（host 模式，绑定 3088 端口）
echo "[*] 启动容器 surfcore-companion..."
docker run -d \
    --name surfcore-companion \
    --restart always \
    --net host \
    -v "$(pwd)/config.json:/app/config.json" \
    -v "$(pwd)/roles:/app/roles" \
    -v "$(pwd)/data:/app/data" \
    surfcore-server:latest

echo "========================================================"
echo " SUCCESS! SurfCore 小娘子服务已在软路由上成功常驻运行！"
echo " 访问健康检查: http://127.0.0.1:3088/health"
echo " 手机端 App 设置: 将连接地址改为 http://软路由IP:3088"
echo "========================================================"
