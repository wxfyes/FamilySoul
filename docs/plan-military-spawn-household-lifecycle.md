# 军饷月结与危机状态机 · 新人入世底座 · 中馈月例重构方案

> **编制依据**：用户对“军饷日扣违背常识、欠饷兵变缺失”、“新人进场底座单薄如塑料”、“小家柴米油盐中馈”的核心指示。  
> **指导思想**：恪守《AGENTS.md》最高第一铁律，彻底禁止打补丁，从**状态机规则、单一数据写入口、社会因果网络**三层治本。  
> **任务目标**：将古代真正的军旅放饷与欠饷危机、市井新人入世的血肉因果、以及王家小日子的中馈月例全量落地。

---

## 模块一：军饷月结与拖欠兵变危机状态机（彻底废除日扣）

### 1. 痛点诊断
目前 `src/world/warfare.js:250` 每日执行 `total * (MONTHLY_PAY / 30)`：
- 古代军队绝无“每日发碎银”之理，日扣导致相公某天手头偶尔没现银就立即判定欠饷、逃兵，极其荒唐；
- 抹杀了古代军队最惊心动魄的矛盾——**【拖欠军饷、军心浮动、逃兵与营中哗变】**。

### 2. 架构正道设计
在 `src/world/warfare.js` 与 `src/world/clock.js` 实施三步重构：

#### ① 口粮与饷银权责分离
- **吃粮（日结）**：维持每日扣粮（每日每兵 0.02 石，兵营每日生火造饭）；
- **发饷（月结）**：**彻底删除每日扣饷代码**，改为每 30 个世界日（放饷日）集中发放。

#### ② 建立欠饷危机状态机（`faction.arrears`）
势力表增加欠饷结构：
```javascript
f.arrears = {
  unpaidMonths: 0,    // 连续拖欠月数
  debtSilver: 0,      // 累计拖欠饷银总额
  lastPayDay: 0       // 上次放饷世界日
};
```

每月放饷日（`day % 30 === 0`）运行 `runMilitaryMonthlyPay(world, events)`：
```javascript
export function runMilitaryMonthlyPay(world, events) {
  for (const f of Object.values(world.factions || {})) {
    if (!f || num(f.troops) <= 0) continue;
    const need = round2(num(f.troops) * MONTHLY_PAY); // 每兵 1 两
    const paid = spendFactionSilver(world, f, need);

    if (paid) {
      // 足额放饷
      f.arrears.unpaidMonths = 0;
      f.arrears.debtSilver = 0;
      f.morale = Math.min(100, num(f.morale) + 5);
      fire(world, { action: 'army_paid', actor: f.leader, payload: { text: `${f.name}如期足额发放月饷 ${need} 两，三军欢呼` } });
    } else {
      // 欠饷！危机升级
      f.arrears.unpaidMonths = (f.arrears.unpaidMonths || 0) + 1;
      f.arrears.debtSilver = round2((f.arrears.debtSilver || 0) + need);

      if (f.arrears.unpaidMonths === 1) {
        // 欠饷 1 个月：怨言四起
        f.morale = Math.max(0, num(f.morale) - 15);
        fire(world, { action: 'army_unpaid_1', actor: f.leader, payload: { text: `${f.name}月饷无着，拖欠 ${f.arrears.debtSilver} 两，营中怨声四起` } });
      } else if (f.arrears.unpaidMonths === 2) {
        // 欠饷 2 个月：开小差逃兵、偷当兵甲
        f.morale = Math.max(0, num(f.morale) - 25);
        const flee = Math.max(2, Math.round(num(f.troops) * 0.2));
        reduceTroops(world, f, flee);
        fire(world, { action: 'army_desert', actor: f.leader, payload: { text: `${f.name}欠饷两月，士卒心寒，夜半逃走 ${flee} 人` } });
      } else if (f.arrears.unpaidMonths >= 3) {
        // 欠饷 3 个月以上：兵变哗变！
        const rebel = Math.max(5, Math.round(num(f.troops) * 0.4));
        reduceTroops(world, f, rebel);
        f.morale = 20;
        fire(world, { action: 'army_mutiny', actor: f.leader, payload: { text: `${f.name}欠饷百日，军营哗变！乱兵哄抢库房作鸟兽散` } });
      }
    }
  }
}
```

#### ③ 支持随时“补发积欠军饷 / 犒赏”
暴露接口 `POST /api/world/military/repay`：
相公随时可筹款把 `f.arrears.debtSilver` 补齐，士兵补领白花花银两，军心瞬间大振、士气回血。

---

## 模块二：新人入世五重因果底座（重塑 `dispatch.js` 的 `spawn`）

### 1. 痛点诊断
目前 `src/world/dispatch.js:285-335` 生成新人：
- 凭空造一个铺子，塞一套死板日程；没有籍贯出身、无来临江动机、眼里只有相公一人（社交孤岛）、身上无盘缠、街坊无反应，塑料感极重。

### 2. 架构正道设计
彻底重构 `spawn` 底座，引入纯函数 `generateActorOrigin(name, role, world)`：

#### ① 籍贯与出身动机（来龙去脉）
新人自动抽取符合古代世情的**【入世身份】**：
- **避灾流民型**：徐州/豫东遭大旱，携家带口南下乞食的匠人/苦力（随身银 0.2 两，甚至欠外债 1 两）；
- **商帮驻埠型**：徽商/洞庭商帮引荐来临江设铺的掌柜（随身银 30~80 两，挂靠 `临江商帮`）；
- **落第寄居型**：江南道落第文士，客居茶肆替客商写家信算账（随身银 1.5 两）；
- **江湖行旅型**：运河漕运镖师、跑船水手，暂歇客栈（随身银 4~10 两）。

#### ② 社交纽带与宗族锚定（拒绝孤岛）
生成新人时，不再是 `relations: { husband: ... }`：
- **同姓归族**：若新人姓沈、林、王、陆，自动关联城内对应宗族（`clans`）；
- **街坊保甲**：自动与落脚地同一地点的 1~2 位街坊建立 `街坊 (浅交)` 关系（如：王婆是紫嫣与阿吉的街坊）；
- **对相公的初始态度**：根据相公名声（仁商/义士）赋予基础好感（40~60）。

#### ③ 市井风闻全城联动
新人进场 `spawn` 成功后，自动注入一条市井风闻：
```javascript
addRumor(world, {
  text: `东街新来了一位${role}「${name}」，据说是从${originPlace}避乱过来的`,
  about: [id],
  weight: 3
});
```
客商与内眷（婉儿/芸娘）在茶余饭后自然能念叨出新邻居。

---

## 模块三：小家柴米油盐与中馈月例底座

### 1. 痛点诊断
缺乏市井细碎开销体系，但若事事买菜记账又会陷入微观灾难。

### 2. 架构正道设计：古代大家族【中馈月例制】

#### ① 公中柴米月例银（宏观物理底座）
在 `world.assets` 中确立 `householdAllowance`（公中月例）：
- 基础开销：每月 15 两白银（涵盖厨房割肉买菜、油盐酱醋、薪炭柴火、伙计丫鬟伙食）；
- 随府中女眷人数与人手自动按人头微调（`10 + householdCount * 2.5` 两/月）；
- 每月由管家/芸娘从府库统一支取，底层自发运转，平稳自洽。

#### ② 节令中馈烟火（天道剧情涌现）
大模型在日常闲聊中，结合时节自动生成中馈日常：
- **立冬**：芸娘报账添置无烟银丝炭、给全府裁做冬衣；
- **端午/中秋**：婉儿张罗分送街坊节礼、备办桂花蜜饯；
- **银两充裕**：红颜喜笑颜开；若府库亏空，内眷主动典当私房共渡难关。

#### ③ 相公随街采买大件（情趣与浪漫）
支持相公在东街购买高阶家私与绫罗绸缎：
- 绸缎庄购“苏绣锦缎”（8两）➔ 赠发妻婉儿，情意大涨；
- 木器行购“黄花梨拔步床”（35两）➔ 换入卧房，提升闺房情趣与受孕福气。

---

## 四、 验收与回归标准

| 验收项目 | 期望行为 |
|---|---|
| **军饷发放** | 每日不再扣碎银；每 30 天统一扣月饷（1两/兵/月） |
| **拖欠军饷** | 欠饷 1 月士气 -15 怨言；欠饷 2 月逃兵 20%；欠饷 3 月营中哗变 |
| **补发积欠** | 相公筹钱补发积欠军饷后，士气立刻止跌回升 |
| **新人进场** | 带有明确籍贯动机、初始盘缠、自动关联街坊宗族，并化为茶客风闻 |
| **中馈月例** | 每月定额扣除公中柴米银，天道自然唠叨应季买炭添衣 |
| **回归测试** | `python scripts/regress.py` 维持 **20/20 全绿** |

