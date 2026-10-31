# ========================================================
# SurfCore Companion Server Dockerfile for iStoreOS / Linux
# Base image: Ultra-lightweight Node.js 22 Alpine (~150MB)
# ========================================================

FROM node:22-alpine

WORKDIR /app

# 安装必要的系统时区、基础证书、Python3 和官方 edge-tts 工具
RUN apk add --no-cache tzdata ca-certificates python3 py3-pip && \
    pip install --no-cache-dir --break-system-packages edge-tts && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 预先复制依赖定义文件
COPY package.json ./

# 安装生产依赖
RUN npm install --omit=dev --no-audit --no-fund

# 复制工程源代码与人设
COPY src/ ./src/
COPY roles/ ./roles/
COPY config.example.json ./

# 创建数据存储目录
RUN mkdir -p data/chat data/voice

# 暴露移动端伴侣服务端口
EXPOSE 3088

# 启动服务
CMD ["node", "src/server.js"]
