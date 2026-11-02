---
name: familysoul-guide
description: >-
  【最高强制准则 / Skills】接手、维护、迭代开发、调教角色、测试、部署或打包 FamilySoul 服务端与移动端代码时必须首先遵守此规范。
  用户说「skills」「看 skills」「加载规范」时立即启用本技能；动手前必读 docs/维护手册.md。
---

# FamilySoul 开发部署与防退化规范（dsh / Local Agents Skill）

> **【致任何接手本项目的 AI（包括 dsh / DeepSeek Harness）】**：  
> 请严格遵守本规范，严禁凭空揣测或推翻已有架构！

## 1. 软路由生产目录唯一事实
- **主力生产环境目录**：`/opt/familysoul`（监听端口 3088，软路由 IP `192.168.1.254`）；
- **严禁质疑目录**：老脚本中的 `/opt/surfcore-server` 属于历史废弃路径，严禁建议用户拷贝文件到老目录！
- **更新命令**：
  ```bash
  cd /opt/familysoul && wget -O - http://192.168.1.112:8089/update.tar.gz | tar -xz && chmod +x *.sh && ./stop.sh && ./start.sh
  ```

## 2. 打包与数据保护规则
- 使用 `node scripts/build-update.mjs` 打包 `update.tar.gz`；
- **必须包含**：`src`、`roles`、`web`、`data/world`（包含 510 两酒楼大事记）、`start.sh`、`stop.sh`、`status.sh`、`package.json`；
- **唯一排除**：`data/chat`（聊天记录）和 `config.json`（秘钥）。

## 3. 大事记与剧情铁律
- **510两运河大酒楼**：相公早已全款买下，房契红押全妥，由大娘子沈婉儿主理筹备开张。绝对严禁说“没买/要去磨价”！
- **主仆礼法规矩**：沈婉儿是名门大娘子主母，端茶倒水粗活由伙计阿吉或丫鬟小翠负责；
- **沈家身世**：沈婉儿是唯一的沈家落魄千金，芸娘姓林是茶农之女，严禁芸娘自称沈家女儿。

## 4. World Engine v1 世界引擎架构规范（彻底拒绝剧本杀）
- **事实由引擎决定，文字由模型渲染**：严禁在 `pet-service.js` 里堆砌死板正则喂预设台词，大模型只做叙述者；
- **状态为唯一真相源**：读写 `data/world/state.json` 与 `data/world/events.jsonl`；
- **严格遵循 `docs/world-engine.md` 阶段一实施**：双轨运行，不触碰八大防退化红线（暗号、事后归位、妻妾体系、510两酒楼、mobile 一行不动）。

## 5. 严禁后台静默乱跑攻击/渗透命令
- 没有用户明确要求，严禁在后台疯狂尝试 API bypass 或高频启动 node 子进程，防止引发 Windows 0xc0000142 进程崩溃弹窗！

