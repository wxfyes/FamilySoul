# FamilySoul Mobile (Flutter 跨平台伴侣客户端)

一套 Dart 源码，支持 **Android** 和 **iOS** 移动端，专为 FamilySoul 设计的私有化全功能聊天伴侣客户端。

---

## 一、核心特性
- **纯私密一对一直连**：无需微信/QQ 平台审核，通过专属 `pet-api` 进行端到端私密直连。
- **语音/文本模式无缝切换**：右上角一键点亮紫色小喇叭即可开启真声原声伴读。
- **作息与状态实时感知**：实时感知伴侣当前状态（在线守护相公 / 侍弄花草 / 休息小憩）。
- **暗号对答与情趣闺房承欢**：内置口令状态机，发送暗号触发专属情趣侍奉。
- **家庭多通行证隔离**：支持相公、老婆、孩子不同身份 Token 切换，分别对应温柔小娘子、贴心大管家与全能导师。
- **双端自适应**：支持 Android 与 iOS，原生流畅，暗色拟态风格。

---

## 二、如何连接 FamilySoul 服务端？

打开 App 顶部的 **设置图标（⚙️）**：
1. **服务器地址**：
   - 局域网（软路由）：如 `http://192.168.1.254:3088`
   - 公网 VPS / 穿透域名：如 `https://your-domain.com` 或 `http://x.x.x.x:3088`
2. **通行令牌 (Token)**：
   - 相公专属：`wxf_husband_exclusive_token_2026`（连接小娘子）
   - 女主人专属：`wife_exclusive_token_8888`（连接贴心大管家）
   - 孩子专属：`kid_exclusive_token_9999`（连接学霸导师）
3. 点击 **【一键测试连接】**，绿灯亮起即代表打通！

---

## 三、双端打包与运行

在 `mobile` 目录下：

### 1. 本地连接手机调试运行：
```bash
flutter run
```

### 2. 打包 Android APK（直接在安卓手机安装）：
```bash
flutter build apk --release
```
编译产物位于：`build/app/outputs/flutter-apk/app-release.apk`。

### 3. 打包 iOS IPA（iPhone 免越狱签名安装）：
本项目已内置 GitHub Actions 自动云端构建流水线：
- 代码推送到 GitHub 后，会自动触发 `.github/workflows/build-mobile-ios.yml` 在 macOS 云主机上编译；
- 编译完成后，在 GitHub 仓库的 **Actions -> Artifacts** 下载 `FamilySoul伴侣_iOS_未签名安装包`；
- 使用 爱思助手 / 巨魔 (TrollStore) / AltStore 签名后即可直接安装在 iPhone 上。
