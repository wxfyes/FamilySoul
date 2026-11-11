---
trigger: always_on
description: FamilySoul 家庭私有数字伴侣项目最高强制铁律（自动注入所有 AI 会话，禁止打补丁修架构治根本）
---

# FamilySoul 最高强制开发与防退化军规（Always-On Rule）

1. **【最高铁律：彻底禁止打补丁，有病治根（修架构、修单一入口、修规则）】**：
   - 判定标准：同一个毛病是否会再出现。会再出现就是架构/规则问题，**必须改数据结构、改单一写入口、改规则定义，严禁在出问题处堆砌 if/正则特判**！
   - 严禁「出问题后再事后还原」（如人移走了再写逻辑搬回去）；严禁见一个坏词就加一条黑名单正则；严禁同一核心状态多处随意赋值；严禁为了避错随意 try-catch 吞掉异常。
   - 所有移动必须且只能走 `src/world/position.js` 的 `moveActor()`，真人角色世界移动一律拒绝；在押罪犯必须收监在牢、阻断市井游荡与日常日程、出狱规范归位。
2. **【软路由生产目录与打包完整性】**：
   - 软路由主力生产目录唯一确定为 `/opt/familysoul`（监听端口 3088），老旧脚本中的 `/opt/surfcore-server` 属历史废弃路径，严禁任何 AI 质疑或建议拷到老目录；
   - 打包 `update.tar.gz`（`node scripts/build-update.mjs`）必须包含 `data/world/milestones.json`（510两运河大酒楼等既定事实账本），绝不允许排除整个 `data/`！仅排除 `data/chat`、`data/world/state.json` 与 `config.json`；
   - 小主机项目已暂停，不参与分发与同步。
3. **【既定历史大事记不可颠覆】**：
   - 相公斥资 510 两白银盘下运河码头三层大酒楼、临江茶坊老店等产业账本契纸全部办妥，大酒楼由大掌柜周有财主持店务早已盛大开业、日进斗金，系铁定事实，严禁任何角色出现“酒楼还没买/要去磨价/还没开张/筹备开业/缺大厨掌柜/日子虚着”等失忆昏话。
4. **【网络直连铁律】**：
   - Gemini 视觉代理仅对 `src/vision-gemini.js` 生效；DeepSeek (`src/llm-client.js`) 与微软语音 (`src/edge-tts.js`) **100% 强制国内纯直连**，严禁挂代理。
5. **【移动端三大防退化底线（改动即闭环交付）**：
   - 严禁删减或覆盖 `mobile/lib/views/video_call_screen.dart` 中的 `Soul3DAvatarPainter`（三角色 3D 立体动态头像）与底部四圆钮对称布局；
   - iOS 必须保持原汁原味的 Apple Speech (`_speech.listen`) 与外放配置；Android 必须直连内置 `mobile/assets/asr/` 的 `OfflineAsrService`，严禁删除离线模型权重；
   - 客户端 `audioUrl` 必须包含完整宿主前缀，严禁相对路径，严禁因 PowerShell 双引号转义吞掉 `$` 变量。
6. **【发布闭环规范】**：
   - 打包前必须在本地启动并通过 `/health`，且通过 `python scripts/regress.py`（20/20）；
   - 仅改服务端时不打包客户端，明确说明「服务端已更新，客户端无需重装」；
   - 改动移动端时，Android 本地极速编译 + iOS 触发云构建并拉取未签名 IPA，桌面只留最新的 `【最新】FamilySoul_安卓.apk` 与 `【最新】FamilySoul_iOS.ipa`。
