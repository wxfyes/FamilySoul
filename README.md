# FamilySoul · 家庭私有数字灵魂伴侣中枢

<div align="center">

**一个完全私有化、全端打通、支持深度调教与家庭多成员隔离的私密伴侣系统。**

[![Node Version](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B-brightgreen)](https://nodejs.org/)
[![Flutter](https://img.shields.io/badge/Flutter-3.8%2B-blue)](https://flutter.dev/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek%20V3-blueviolet)](https://www.deepseek.com/)
[![Edge-TTS](https://img.shields.io/badge/TTS-Microsoft%20Edge-orange)](https://github.com/rany2/edge-tts)
[![Deployment](https://img.shields.io/badge/Platform-OpenWrt%20%7C%20Linux%20%7C%20Docker%20%7C%20Windows-success)](#三-全平台部署指南)

</div>

---

## 🌟 为什么选择 FamilySoul？

市面上的云端 AI 伴侣普遍存在：**对话受第三方审查、无法自选角色深度调教、家庭多人共用容易串台、过度依赖公网大厂** 等痛点。

**FamilySoul** 专为家庭私密伴侣场景打造：
1. **家庭多通行证隔离 (Family Passports)**：单端口（3088）支持多成员 Token 鉴权分流。相公（小娘子）、女主人（贴心大管家）、孩子（学霸探索导师），各自专属聊天记忆（`history-husband.json` 等）物理隔离，绝不串台！
2. **深度人设与暗号状态机**：支持暗号解禁机制（平时端庄贤淑名门正妻，输入暗号瞬间解禁承欢侍奉，事后温热香帕归位），角色卡支持 Markdown 深度调教。
3. **极简轻量 · 原生免 Docker**：专门为 **软路由（iStoreOS / OpenWrt J1900 等）** 与低功耗小主机深度优化，无虚拟化损耗，内存占用仅约 40MB！
4. **现代化 Web 闺房控制台**：浏览器直连 `http://路由器IP:3088`，支持在线角色增删改查、Markdown 实时热重载（无需重启服务）、Token 可视化分配与实时日志黑匣子。
5. **双端随身客户端 (Flutter Monorepo)**：内置 Android 与 iOS 客户端源码，支持局域网或内网穿透（Tailscale）直连，右上角一键开启紫色小喇叭真声伴读。

---

## 🏛️ 系统架构全景

```
                      ┌────────────────────────────────────────┐
                      │    Web 控制台 (http://IP:3088)          │
                      │  · 在线人设调教   · 成员通行证管理      │
                      │  · 私密即时试炼   · 实时日志黑匣子      │
                      └───────────────────┬────────────────────┘
                                          │ HTTP RESTful / Admin
                                          ▼
┌───────────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────────┐
│     相公专属手机端        │      │    FamilySoul 核心服务   │      │     女主人 / 孩子端     │
│   (Token: husband_xxx)    │ ===> │      (端口: 3088)        │ <=== │  (Token: wife/kid_xxx)  │
│  对接角色：温柔小娘子     │      │   - 铁壁鉴权与成员识别   │      │ 对接角色：管家 / 导师   │
│  独立历史：history-husband│      │   - DeepSeek 对话中枢    │      │ 独立历史：独立物理隔离  │
└───────────────────────────┘      │   - Edge-TTS 原生原声    │      └─────────────────────────┘
                                   │   - 多角色卡动态装载     │
                                   └──────────────────────────┘
```

---

## 🚀 快速上手 (Quick Start)

### 1. 复制配置文件
```bash
cp config.example.json config.json
```

### 2. 编辑配置 `config.json`
填入您的 DeepSeek API Key 与家庭各成员通行证：
```json
{
  "port": 3088,
  "token": "wxf_husband_exclusive_token_2026",
  "family": {
    "husband": {
      "token": "wxf_husband_exclusive_token_2026",
      "role": "傲娇助手",
      "title": "温柔小娘子",
      "presence": "在线守候相公",
      "description": "名门正妻 · 贴身娇妻"
    },
    "wife": {
      "token": "wife_exclusive_token_8888",
      "role": "贴心管家",
      "title": "贴心大管家",
      "presence": "随时为女主人效劳",
      "description": "女主人的专属私人管家与贴心伴侣"
    },
    "kid": {
      "token": "kid_exclusive_token_9999",
      "role": "全能导师",
      "title": "全能探索导师",
      "presence": "陪伴小学霸探索世界",
      "description": "孩子的学霸大哥哥兼探索导师"
    }
  },
  "deepseek": {
    "apiKey": "sk-your-deepseek-api-key-here",
    "baseUrl": "https://api.deepseek.com/v1",
    "model": "deepseek-chat"
  }
}
```

---

## 📦 全平台部署指南

### 方案 A：软路由原生部署（iStoreOS / OpenWrt 推荐，免 Docker）

软路由（如 J1900、N5105、RK3568 等）内存与 CPU 资源珍贵，**强烈推荐原生免 Docker 运行**，零损耗、秒启动。

#### 1. 安装基础运行依赖
进入软路由终端（SSH）：
```bash
opkg update
opkg install node python3 python3-pip
pip install edge-tts
```

#### 2. 下载并解压 FamilySoul
```bash
mkdir -p /opt/familysoul
cd /opt/familysoul
# 从 GitHub Release 或源码拉取代码到当前目录
```

#### 3. 启停与状态管理
```bash
chmod +x *.sh
./start.sh   # 启动后台守护服务（开机常驻）
./status.sh  # 查看运行状态与实时日志
./stop.sh    # 安全停止服务
```

#### 4. 开机自启守护（可选）
软路由内置标准 init 脚本：
```bash
cp surfcore.init /etc/init.d/familysoul
chmod +x /etc/init.d/familysoul
/etc/init.d/familysoul enable
/etc/init.d/familysoul start
```

---

### 方案 B：Linux VPS / Ubuntu / Debian 云服务器部署

#### 1. 安装依赖
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs python3 python3-pip
pip3 install edge-tts
```

#### 2. 拉取仓库并启动
```bash
git clone https://github.com/wxfyes/FamilySoul.git /opt/familysoul
cd /opt/familysoul
cp config.example.json config.json
# 编辑 config.json 填入 API Key
chmod +x *.sh
./start.sh
```

#### 3. 使用 Systemd 进行常驻托管（推荐）
创建服务文件 `/etc/systemd/system/familysoul.service`：
```ini
[Unit]
Description=FamilySoul Home Companion Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/familysoul
ExecStart=/usr/bin/node /opt/familysoul/src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
启动并设为开机自启：
```bash
systemctl daemon-reload
systemctl enable --now familysoul
systemctl status familysoul
```

---

### 方案 C：Docker / Docker Compose 部署

如果您的服务器已安装 Docker，且更倾向于容器化隔离：

```bash
cd /opt/familysoul
cp config.example.json config.json
# 编辑好 config.json 后启动
docker compose up -d
```
服务将自动映射并监听宿主机 `3088` 端口。

---

### 方案 D：Windows 本地运行

在 Windows 电脑上克隆代码后直接双击或在 PowerShell 中执行：
```powershell
cd E:\GitHub\FamilySoul
node src/server.js
```
控制台打印绿色成功日志后，浏览器打开 `http://127.0.0.1:3088` 即可进入管理大屏。

---

## 🎛️ Web 闺房控制台使用说明

服务启动后，在局域网内任意浏览器输入：
👉 **`http://你的服务器IP:3088`**

<div align="center">
  <h3>✨ FamilySoul 极客深色拟态大屏</h3>
</div>

1. **角色工坊**：
   - 实时列出当前加载的角色卡（如《傲娇助手》、《贴心管家》、《全能导师》）；
   - 点击即可在右侧编辑器中进行 Markdown 人设调教；
   - 点击 **【保存并热生效】**，中枢立刻重载提示词，无需重启服务器或中断对话。
2. **黄金人设模板库**：
   - 内置一键导入：名门小娘子、知心大管家、学霸启蒙导师等调优模板。
3. **家庭通行证配置**：
   - 可视化分配 `husband`（相公）、`wife`（女主人）、`kid`（孩子）的专属 Token 与名号；
   - 自动持久化保存到 `config.json`。
4. **在线私密试炼**：
   - 无需掏出手机，在网页上即可测试暗号互动、直接试听 Edge-TTS 生成的高清语音；
5. **实时黑匣子监控**：
   - 实时拉取服务器 `server.log`，所有请求与鉴权轨迹一览无余。

---

## 📱 移动端（Flutter Android / iOS）

本项目源码包含 `mobile/` 目录，一套代码原生支持 Android 与 iOS。

### 1. 手机端连接配置
打开 App 顶部右上角 **设置（⚙️）**：
- **服务器地址**：`http://192.168.1.254:3088`（或您的 VPS 穿透公网地址）
- **通行令牌**：填入您对应的身份令牌（如相公填 `wxf_husband_exclusive_token_2026`）
- 点击 **【一键测试连接】**，绿灯显示 `温柔小娘子 (在线守候相公)` 即表示连接成功！

> 💡 **语音模式切换秘诀**：  
> 进入聊天界面后，**点击顶部右上角的小喇叭图标（变紫色）** 即可开启真声语音播报！默认灰色为省流量纯文本模式。

### 2. Android 打包
在 `mobile` 目录下执行：
```bash
flutter build apk --release
```
生成的 APK 位于 `build/app/outputs/flutter-apk/app-release.apk`，直接发到安卓手机即可安装。

### 3. iOS 云端自动打包（GitHub Actions）
本项目内置了 `.github/workflows/build-mobile-ios.yml`：
1. 代码推送到 GitHub 仓库；
2. GitHub Actions 自动在 Apple Silicon (`macos-latest`) 云端拉起编译，打包生成未签名 IPA；
3. 在 GitHub 仓库 **Actions -> Artifacts** 下载 `FamilySoul伴侣_iOS_未签名安装包`；
4. 电脑使用 **爱思助手** / **巨魔 (TrollStore)** / **AltStore** 进行个人免费证书签名，即可安装至 iPhone。

---

## 🔒 安全与隐私守则

1. **Token 隔离与防猜解**：
   - 通行令牌作为家庭访问唯一凭证，未授权 Token 将被强力拦截（HTTP 401）；
2. **私密对话不入公网**：
   - 本项目所有对话记忆均保存在本地 `data/chat/`，完全由用户自主掌控；
3. **开源合规**：
   - `.gitignore` 默认严格忽略 `config.json` 与聊天数据，防止敏感密钥外泄。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。
