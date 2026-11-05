# 市井人物岁数、婚配与生理周期真实化纠偏整改方案

> **问题定位**：市井 NPC（如“王婆”）名带“婆”字却被算成 26 岁少女并来例假排卵；61 岁“李婶”显示未婚且身子留白。  
> **根因剖析**：代码在推导年龄时**只正则匹配了职业 `role`（如“面摊”），漏掉了姓名 `name`（“王婆”）**，导致跌落兜底逻辑算成 20 出头；同时天道衍生人物**漏掉了婚姻状态字段**，前端粗暴兜底成“未婚”，绝经后又直接留白。  
> **治理原则**：恪守《AGENTS.md》最高第一铁律，彻底禁止个案特判打补丁，从**称谓年龄规则体系、古代婚配状态机、生理状态呈现**三层治本。

---

## 一、 第一层：姓名与身份双重归类的称谓年龄规则（修规则体系）

### 1. 痛点根源
`src/world/state.js:1353`：
```javascript
// ❌ 错误做法：只看 role，没看 name
else if (/婆/.test(role)) a.age = 48 + (id.length % 10);
else a.age = 20 + (id.length % 25); // 王婆的 role 是"面摊"，被误判成 26 岁少女！
```

### 2. 架构正道：提取单一推导函数 `inferAgeFromIdentity(name, role, gender)`
在 `src/world/state.js` 与 `src/world/dispatch.js`（天道衍生）统一调用单一规则，匹配文本必须为 `text = "${name} ${role}"`：

```javascript
/**
 * 根据姓名与身份常理推导古代真实年龄区间
 */
export function inferAgeFromIdentity(name = '', role = '', gender = 'female', id = '') {
  const text = `${name} ${role}`;
  const seed = String(id || name).length;

  // 1. 耆老长者（婆、嬷嬷、妪、翁、老汉、老叟、太师、老道、大儒）
  if (/婆|嬷嬷|老太|妪|妪人|老母|翁|老汉|老者|老仆|老道|老僧|夫子/.test(text)) {
    return 50 + (seed % 16); // 50 ~ 65 岁
  }
  // 2. 中年长辈（婶、大娘、大叔、伯父、管事、老鸨、掌柜、按察知府）
  if (/婶|大娘|大叔|大爷|伯|鸨|巡抚|知府|尚书|侍郎/.test(text)) {
    return 40 + (seed % 14); // 40 ~ 53 岁
  }
  // 3. 青年妇人/成熟男子（嫂、妇人、小娘子、娘子、书吏、捕快、镖师、当家）
  if (/嫂|妇|娘子|当家|捕快|镖师|典吏|县丞/.test(text)) {
    return 26 + (seed % 12); // 26 ~ 37 岁
  }
  // 4. 豆蔻金钗/青壮学子（姑娘、丫鬟、丫头、侍女、小厮、伙计、书童、学子）
  if (/丫鬟|丫头|侍女|小厮|书童|学子|学徒|伙计/.test(text)) {
    return 16 + (seed % 6);  // 16 ~ 21 岁
  }
  // 5. 幼童子嗣（孩、儿、幼）
  if (/婴|儿|童|幼/.test(text)) {
    return 5 + (seed % 9);   // 5 ~ 13 岁
  }

  // 兜底成年人（男女适龄）
  return 22 + (seed % 14);   // 22 ~ 35 岁
}
```

---

## 二、 第二层：古代市井婚姻状态机（彻底根治“61岁未婚老太”）

### 1. 痛点根源
`web/dashboard.html:2406`：
```javascript
// ❌ 错误做法：没有婚姻字段就全部当成未婚少女
if (!a.marital) return '未婚';
```
古代社会早婚普遍，61 岁洗衣妇绝无可能被全城当作“待字闺中未婚”。

### 2. 架构正道：补齐古代婚姻状态与推导规则
在 `src/world/state.js` 统一自愈，并在前端 `maritalText(a)` 严密自洽：

```javascript
/**
 * 古代市井婚姻状态推导
 * @returns {'married' | 'widowed' | 'single' | 'concubine'}
 */
export function inferMaritalStatus(name = '', role = '', age = 20, gender = 'female') {
  const text = `${name} ${role}`;

  // 显式寡居标记
  if (/寡|孀|亡夫|先夫/.test(text)) return 'widowed';
  // 显式妾室
  if (/妾|二房|小妾|姨娘/.test(text)) return 'concubine';

  // 年长妇人（>= 45岁）：长者按古代世情，要么老伴在堂，要么寡居守节
  if (age >= 45) {
    // 婆子、老妇人约 40% 丧偶孀居，60% 老伴在侧
    const hash = String(name).length;
    return (hash % 10 < 4) ? 'widowed' : 'married';
  }

  // 适龄成熟女子（24 ~ 44岁）：在古代几乎全部已成家
  if (age >= 24) {
    if (/娘子|嫂|妇人|婶/.test(text)) return 'married';
    return 'married';
  }

  // 年轻适龄（< 24岁）：未出阁姑娘或丫鬟侍女
  if (/丫鬟|丫头|姑娘|少女/.test(text) || age < 20) {
    return 'single';
  }

  return 'married';
}
```

前端展示优化：
- `widowed` ➔ 显示：`寡居 · 操持营生`（符合李婶老寡妇替人洗衣的人设）；
- `married` ➔ 显示：`已婚`；
- `single` ➔ 显示：`未婚 · 待字闺中`；
- `household` ➔ 显示：`已婚 · 王府内眷`。

---

## 三、 第三层：女性生理周期（身子）全生命周期展示（拒绝绝经留白）

### 1. 痛点根源
`state.js:696` 规定大于 52 岁不参与 `runMenses` 月事计算，前端检测到没有生理周期直接输出空白 `""`，导致 61 岁的李婶“身子：”后面空无一物。

### 2. 架构正道：医学常理全年龄段状态覆盖
在人物详情弹窗与看板渲染中，身子生理状态统一格式化：

```javascript
function formatMensesStatus(a) {
  if (a.gender !== 'female') return '—';
  const age = Number(a.age) || 0;

  // 1. 年长绝经（更年期后，功德完满）
  if (age >= 50) {
    return '<span class="muted">年长绝经 · 子息已毕</span>';
  }
  // 2. 年幼未破瓜
  if (age > 0 && age < 14) {
    return '<span class="muted">金钗幼女 · 尚未破瓜</span>';
  }
  // 3. 身怀六甲
  if (a.pregnancy && !a.pregnancy.born) {
    const months = Math.max(1, Math.floor((a.pregnancy.days || 0) / 30));
    return `<span class="warn">身怀六甲 · 孕${months}月有余</span>`;
  }
  // 4. 正在经期
  if (a.onPeriod) {
    return '<span class="bad">月事方至 · 不便行房</span>';
  }
  // 5. 育龄日常周期
  const m = a.menses || {};
  const day = Number(m.dayInCycle) || 1;
  const fertile = day >= 10 && day <= 16;
  if (fertile) {
    return `<span class="good">月事周期第 ${day} 天 · 易受孕期</span>`;
  }
  return `<span>月事周期第 ${day} 天</span>`;
}
```

---

## 四、 第四层：存量数据清洗自愈（Heal & Migration）

为保证线上正在运行的 `state.json` 自动平滑愈合，在 `src/world/heal.js` 的 `healWorld` 中加入自愈逻辑（改一次全部自愈，不用写一次性 patch）：

1. **扫描所有 NPC**：
   - 若 `name` 或 `role` 带“婆/嬷嬷/翁”，而 `age < 45`（如王婆 26 岁）：
     自动按 `inferAgeFromIdentity(a.name, a.role, a.gender, a.id)` 重置为真实长者岁数（如 52 岁）；
     若年龄重置后 >= 50 岁，清空其身上残留的荒唐月事（`delete a.menses`）；
   - 若成年 NPC（age >= 24）缺少 `marital` 字段，自动按常理赋予 `marital: 'married'` 或 `'widowed'`；
2. **记录自愈日志**：
   控制台输出：`[Heal] 王婆（原26岁）校正为长者 52 岁·婚配已婚·已绝经`。

---

## 五、 交付检查验收标准

| 验收项 | 期望表现 | 判定标准 |
|---|---|---|
| **王婆 面摊** | 年龄变为 50~58 岁；身子显示“年长绝经”；婚配显示“已婚” | 严禁再出现 26 岁少女面相和来例假排卵 |
| **李婶 浆洗婆子** | 年龄 61 岁；婚配显示“寡居·操持营生”；身子显示“年长绝经 · 子息已毕” | 严禁显示“未婚”与“身子留白” |
| **年轻内眷/丫鬟** | 婉儿（21岁）、芸娘（19岁）正常显示月事周期第X天或有孕；丫鬟显示待字未婚 | 育龄女子正常生理周期不受任何破坏 |
| **回归测试** | `python scripts/regress.py` | 维持 **20/20 全绿** |

