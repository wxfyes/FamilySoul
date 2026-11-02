---
trigger: always_on
description: FamilySoul 家庭私有数字伴侣项目最高强制铁律（自动注入所有 AI 会话，强制阅读 familysoul-guide 技能）
---

# FamilySoul 最高强制开发与防退化军规（Always-On Rule）

1. **【强制阅读技能】**：在接触、修改、调试或打包本仓库（`FamilySoul`）的任何代码前，**必须第一时间调用 `read_file` 阅读 `C:\Users\nasstoki\.gemini\config\skills\familysoul-guide\SKILL.md`、`C:\Users\nasstoki\.gemini\config\skills\familysoul-world-sandbox\SKILL.md` 与 `C:\Users\nasstoki\.gemini\config\skills\deploy-surfcore-mobile\SKILL.md`**，绝不允许跳过！
2. **【严禁退化与覆盖】**：
   - 严禁删减或覆盖 `mobile/lib/views/video_call_screen.dart` 中的 `Soul3DAvatarPainter`（三角色 3D 立体动态头像：小娘子/贴心男管家/全能导师）、底部四圆钮对称布局（`翻转` / `看相公·看夫人·看同学` / `麦克风` / `挂断`）以及 `_cleanSubtitle` 字幕乱码过滤器；
   - **iOS 端语音零破坏**：`Platform.isIOS` 必须 100% 保持原汁原味的 Apple Speech (`_speech.listen`) 连续倾听与 `AVAudioSessionCategory.playAndRecord` + `defaultToSpeaker` 外放配置，严禁乱改；
   - **Android 端内置离线中文包**：`Platform.isAndroid` 必须 100% 使用内置于 `mobile/assets/asr/` 的 `OfflineAsrService` (`sherpa_onnx` Streaming Zipformer-zh)，严禁删除本地 `mobile/assets/asr/*.onnx` 权重文件。
3. **【音频 URL 完整性与防吞变量】**：
   - 客户端所有 `audioUrl` 必须包含完整宿主前缀 `${config.apiPrefix}/audio/$audioKey.wav?token=${Uri.encodeComponent(config.token.trim())}`，严禁使用相对路径；
   - 严禁在 PowerShell 双引号内使用 `node -e "... $audioKey ..."` 替换 Dart 源码（会吞掉 `$` 变量导致静音 Bug）。
4. **【只管谷歌，其他直连】**：
   - Gemini 代理仅对 `src/vision-gemini.js` 生效；DeepSeek (`src/llm-client.js`) 与微软语音 (`src/edge-tts.js`) 100% 强制国内纯直连。
5. **【改动即双端编译发布闭环】**：
   - 修改 `mobile/` 后，必须同步完成 Android APK 本地编译 + iOS GitHub Actions 云端编译拉取 + 同步到桌面、小主机共享目录 (`\\192.168.1.213\H5\surfcore_family_update`) 与 GitHub Releases！
6. **【软路由真实生产目录与打包完整性】**：
   - 软路由生产环境目录唯一确定为 `/opt/familysoul`（监听端口 3088），老旧脚本中的 `/opt/surfcore-server` 属历史废弃路径，严禁任何 AI 质疑或建议拷到老目录；
   - 打包 `update.tar.gz` 时必须包含 `data/world`（世界大事记与产业账本），绝不允许大笔一挥排除整个 `data/`！仅排除 `data/chat`（聊天记录）与 `config.json`（私钥）；
7. **【严禁后台静默乱跑攻击与高频命令】**：
   - 未获用户明确要求前，严禁擅自在后台高频派生子进程去测试 API bypass 或扫描端口，避免引发 Windows 0xc0000142 进程注入崩溃弹窗！

